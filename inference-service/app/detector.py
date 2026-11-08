"""
YOLO11s Computer Vision Detector Module for Fridge2Food.

Designed specifically for the user's fine-tuned 26-class Roboflow YOLO11s model:
  - Model file: fridge_to_plate_yolo11s.pt
  - Roboflow dataset: yolo-training-uygwi/ingredients-p3tk0 (v1, YOLOv11)
  - Input resolution: 640x640 (aspect-ratio preserving letterbox handled by Ultralytics)
  - Reads class names dynamically from `result.names` / `model.names`
  - Loads weights ONCE at startup and reuses across all requests
  - Wraps inference in `torch.inference_mode()` with a Semaphore/Lock to prevent
    uncontrolled concurrent GPU/CPU memory spikes
"""

import io
import logging
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
from PIL import Image, ImageOps, UnidentifiedImageError

try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover
    YOLO = None

from app.config import settings
from app.schemas import (
    AggregatedIngredientSummary,
    BoundingBox,
    DetectionItem,
    ImageDimensions,
    ImagePredictionResult,
)

logger = logging.getLogger("smartplate.detector")


def format_ingredient_name(raw_name: str) -> str:
    """
    Convert a raw YOLO class label (e.g., 'bell_pepper', 'red-onion', 'cherry_tomato')
    into a clean, human-readable title-case ingredient name ('Bell Pepper', 'Red Onion').
    """
    if not raw_name:
        return "Unknown Ingredient"
    cleaned = raw_name.replace("_", " ").replace("-", " ").strip()
    return " ".join(word.capitalize() for word in cleaned.split())


class IngredientDetector:
    """
    Singleton-style wrapper around the fine-tuned Ultralytics YOLO11s object detection model.
    """

    def __init__(self, model_path: Optional[Path] = None) -> None:
        self.model_path: Path = Path(model_path) if model_path else settings.MODEL_PATH
        self.model: Optional[Any] = None
        self.device: str = self._resolve_device(settings.INFERENCE_DEVICE)
        self.class_names: Dict[int, str] = {}
        self.is_loaded: bool = False
        self.load_error: Optional[str] = None
        # Concurrency semaphore to prevent uncontrolled concurrent GPU/CPU inference
        self._inference_semaphore = threading.BoundedSemaphore(
            value=settings.MAX_CONCURRENT_INFERENCES
        )
        self._load_lock = threading.Lock()

    @staticmethod
    def _resolve_device(requested_device: str) -> str:
        """Select optimal PyTorch device with safe fallback to CPU."""
        req = (requested_device or "auto").lower().strip()
        if req == "auto":
            if torch.cuda.is_available():
                return "cuda:0"
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
            return "cpu"
        if req.startswith("cuda") and not torch.cuda.is_available():
            logger.warning(
                "CUDA requested (%s) but torch.cuda.is_available() is False. Falling back to CPU.",
                requested_device,
            )
            return "cpu"
        if req == "mps" and not (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        ):
            logger.warning("MPS requested but unavailable. Falling back to CPU.")
            return "cpu"
        return requested_device

    def load_model(self) -> bool:
        """
        Load `fridge_to_plate_yolo11s.pt` into memory once during application startup.
        Never downloads or substitutes a generic pretrained model.
        """
        with self._load_lock:
            if self.is_loaded and self.model is not None:
                return True

            if YOLO is None:
                self.load_error = (
                    "Ultralytics library is not installed. Run `pip install -r requirements.txt`."
                )
                logger.error(self.load_error)
                return False

            if not self.model_path.exists() or not self.model_path.is_file():
                self.load_error = (
                    f"Fine-tuned YOLO11s model file not found at '{self.model_path.name}'. "
                    "Please place your exported 'fridge_to_plate_yolo11s.pt' weights inside "
                    "the 'models/' directory and restart the inference service."
                )
                logger.warning(self.load_error)
                return False

            try:
                logger.info(
                    "Loading fine-tuned YOLO11s model from %s on device %s...",
                    self.model_path.name,
                    self.device,
                )
                start_ts = time.perf_counter()
                loaded_model = YOLO(str(self.model_path), task="detect")
                loaded_model.to(self.device)

                raw_names = getattr(loaded_model, "names", {}) or {}
                if isinstance(raw_names, list):
                    self.class_names = {idx: str(name) for idx, name in enumerate(raw_names)}
                elif isinstance(raw_names, dict):
                    self.class_names = {int(k): str(v) for k, v in raw_names.items()}
                else:
                    self.class_names = {}

                self.model = loaded_model
                self.is_loaded = True
                self.load_error = None
                elapsed_ms = (time.perf_counter() - start_ts) * 1000.0
                logger.info(
                    "Successfully loaded %s (%d classes) on %s in %.1f ms.",
                    self.model_path.name,
                    len(self.class_names),
                    self.device,
                    elapsed_ms,
                )
                return True
            except Exception as exc:
                self.is_loaded = False
                self.model = None
                self.load_error = f"Failed to load YOLO11s model '{self.model_path.name}': {exc}"
                logger.exception(self.load_error)
                return False

    @staticmethod
    def decode_and_validate_image(
        raw_bytes: bytes, filename: str
    ) -> Tuple[Optional[np.ndarray], Optional[ImageDimensions], Optional[str]]:
        """
        Safely validate and decode an uploaded image into a BGR NumPy array for Ultralytics YOLO
        without distorting its native aspect ratio. Applies EXIF orientation transposition so
        mobile phone photos of fridges/ingredients have upright bounding boxes.
        """
        if not raw_bytes:
            return None, None, f"Uploaded file '{filename}' is empty (0 bytes)."

        if len(raw_bytes) > settings.MAX_UPLOAD_SIZE:
            max_mb = settings.MAX_UPLOAD_SIZE / (1024 * 1024)
            return (
                None,
                None,
                f"Uploaded file '{filename}' exceeds the maximum allowed size of {max_mb:.1f} MB.",
            )

        try:
            with Image.open(io.BytesIO(raw_bytes)) as pil_img:
                pil_img.verify()

            with Image.open(io.BytesIO(raw_bytes)) as pil_img:
                # Respect EXIF orientation tags from smartphone cameras
                pil_img = ImageOps.exif_transpose(pil_img)
                rgb_img = pil_img.convert("RGB")
                width, height = rgb_img.size

                if width < 16 or height < 16:
                    return (
                        None,
                        None,
                        f"Image '{filename}' is too small ({width}x{height}px). Minimum is 16x16px.",
                    )

                rgb_array = np.asarray(rgb_img, dtype=np.uint8)
                # Convert RGB to BGR for OpenCV / Ultralytics consistency
                bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
                return (
                    bgr_array,
                    ImageDimensions(width=width, height=height),
                    None,
                )
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            return (
                None,
                None,
                f"File '{filename}' is not a valid or supported image: {exc}",
            )

    def predict_batch(
        self,
        images_payload: List[Tuple[str, bytes]],
        confidence_threshold: Optional[float] = None,
        iou_threshold: Optional[float] = None,
    ) -> Tuple[List[ImagePredictionResult], List[AggregatedIngredientSummary], float]:
        """
        Run object detection on a batch of uploaded images using `torch.inference_mode()`.
        Uses dynamic class mappings from `result.names` and preserves aspect ratios.
        """
        if not self.is_loaded or self.model is None:
            if not self.load_model():
                raise RuntimeError(
                    self.load_error
                    or "YOLO11s model is not loaded. Place fridge_to_plate_yolo11s.pt in models/."
                )

        conf = (
            confidence_threshold
            if confidence_threshold is not None
            else settings.CONFIDENCE_THRESHOLD
        )
        iou = iou_threshold if iou_threshold is not None else settings.IOU_THRESHOLD

        batch_start = time.perf_counter()
        results_list: List[ImagePredictionResult] = []

        # Decode and validate each image first
        valid_entries: List[Tuple[int, str, np.ndarray, ImageDimensions]] = []
        invalid_map: Dict[int, ImagePredictionResult] = {}

        for idx, (filename, raw_bytes) in enumerate(images_payload):
            bgr_img, dims, err_msg = self.decode_and_validate_image(raw_bytes, filename)
            if err_msg or bgr_img is None or dims is None:
                invalid_map[idx] = ImagePredictionResult(
                    image_index=idx,
                    filename=filename,
                    success=False,
                    dimensions=None,
                    detections=[],
                    detection_count=0,
                    inference_time_ms=0.0,
                    error=err_msg or "Invalid image file.",
                )
            else:
                valid_entries.append((idx, filename, bgr_img, dims))

        # Run controlled inference inside BoundedSemaphore + torch.inference_mode()
        valid_predictions: Dict[int, ImagePredictionResult] = {}
        if valid_entries:
            with self._inference_semaphore:
                with torch.inference_mode():
                    for idx, filename, bgr_img, dims in valid_entries:
                        img_start = time.perf_counter()
                        try:
                            yolo_outputs = self.model.predict(
                                source=bgr_img,
                                imgsz=settings.IMAGE_SIZE,
                                conf=conf,
                                iou=iou,
                                device=self.device,
                                verbose=False,
                            )
                            elapsed_img_ms = (time.perf_counter() - img_start) * 1000.0
                            detections = self._parse_yolo_result(
                                yolo_outputs[0] if yolo_outputs else None,
                                dims=dims,
                            )
                            valid_predictions[idx] = ImagePredictionResult(
                                image_index=idx,
                                filename=filename,
                                success=True,
                                dimensions=dims,
                                detections=detections,
                                detection_count=len(detections),
                                inference_time_ms=round(elapsed_img_ms, 2),
                                error=None,
                            )
                        except Exception as exc:
                            logger.exception("Inference error on image '%s'", filename)
                            elapsed_img_ms = (time.perf_counter() - img_start) * 1000.0
                            valid_predictions[idx] = ImagePredictionResult(
                                image_index=idx,
                                filename=filename,
                                success=False,
                                dimensions=dims,
                                detections=[],
                                detection_count=0,
                                inference_time_ms=round(elapsed_img_ms, 2),
                                error=f"Object detection failed for '{filename}': {exc}",
                            )

        for idx in range(len(images_payload)):
            if idx in invalid_map:
                results_list.append(invalid_map[idx])
            elif idx in valid_predictions:
                results_list.append(valid_predictions[idx])

        aggregated = self._aggregate_ingredients(results_list)
        total_time_ms = round((time.perf_counter() - batch_start) * 1000.0, 2)
        return results_list, aggregated, total_time_ms

    def _parse_yolo_result(
        self, result: Any, dims: ImageDimensions
    ) -> List[DetectionItem]:
        """
        Extract bounding boxes, confidence scores, and class names dynamically from `result.names`.
        """
        if result is None or getattr(result, "boxes", None) is None:
            return []

        # Read class mapping directly from result.names (fallback to self.class_names)
        names_map: Dict[int, str] = {}
        raw_result_names = getattr(result, "names", None) or self.class_names
        if isinstance(raw_result_names, list):
            names_map = {i: str(n) for i, n in enumerate(raw_result_names)}
        elif isinstance(raw_result_names, dict):
            names_map = {int(k): str(v) for k, v in raw_result_names.items()}

        boxes = result.boxes
        if len(boxes) == 0:
            return []

        xyxy_tensor = boxes.xyxy.detach().cpu().numpy()
        conf_tensor = boxes.conf.detach().cpu().numpy()
        cls_tensor = boxes.cls.detach().cpu().numpy()

        img_w = float(dims.width)
        img_h = float(dims.height)

        parsed_items: List[DetectionItem] = []
        for box_idx in range(len(xyxy_tensor)):
            x1, y1, x2, y2 = [float(v) for v in xyxy_tensor[box_idx]]
            # Clamp coordinates strictly to original image boundaries
            x1 = max(0.0, min(img_w, x1))
            y1 = max(0.0, min(img_h, y1))
            x2 = max(x1, min(img_w, x2))
            y2 = max(y1, min(img_h, y2))

            box_w = round(x2 - x1, 2)
            box_h = round(y2 - y1, 2)

            conf_val = float(conf_tensor[box_idx])
            cls_id = int(cls_tensor[box_idx])
            raw_class_name = names_map.get(cls_id, f"class_{cls_id}")
            display_name = format_ingredient_name(raw_class_name)

            norm_coords = [
                round(x1 / img_w, 6) if img_w > 0 else 0.0,
                round(y1 / img_h, 6) if img_h > 0 else 0.0,
                round(x2 / img_w, 6) if img_w > 0 else 0.0,
                round(y2 / img_h, 6) if img_h > 0 else 0.0,
            ]

            parsed_items.append(
                DetectionItem(
                    detection_id=f"det_{uuid.uuid4().hex[:10]}",
                    class_id=cls_id,
                    class_name=raw_class_name,
                    display_name=display_name,
                    confidence=round(conf_val, 4),
                    confidence_percentage=round(conf_val * 100.0, 1),
                    bbox=BoundingBox(
                        x1=round(x1, 2),
                        y1=round(y1, 2),
                        x2=round(x2, 2),
                        y2=round(y2, 2),
                        width=box_w,
                        height=box_h,
                        normalized=norm_coords,
                    ),
                )
            )

        # Sort highest confidence first
        parsed_items.sort(key=lambda item: item.confidence, reverse=True)
        return parsed_items

    @staticmethod
    def _aggregate_ingredients(
        image_results: List[ImagePredictionResult],
    ) -> List[AggregatedIngredientSummary]:
        """
        Deduplicate and merge detected ingredients across all uploaded images in the batch.
        """
        grouped: Dict[str, Dict[str, Any]] = {}
        for img_res in image_results:
            if not img_res.success:
                continue
            for det in img_res.detections:
                key = det.display_name.lower().strip()
                if key not in grouped:
                    grouped[key] = {
                        "name": det.display_name,
                        "raw_class_name": det.class_name,
                        "count": 0,
                        "confidences": [],
                        "source_images": [],
                    }
                grouped[key]["count"] += 1
                grouped[key]["confidences"].append(det.confidence)
                if img_res.filename not in grouped[key]["source_images"]:
                    grouped[key]["source_images"].append(img_res.filename)

        summaries: List[AggregatedIngredientSummary] = []
        for entry in grouped.values():
            confs = entry["confidences"]
            max_c = max(confs) if confs else 0.0
            avg_c = (sum(confs) / len(confs)) if confs else 0.0
            summaries.append(
                AggregatedIngredientSummary(
                    name=entry["name"],
                    raw_class_name=entry["raw_class_name"],
                    count=entry["count"],
                    max_confidence=round(max_c, 4),
                    avg_confidence=round(avg_c, 4),
                    source_images=entry["source_images"],
                )
            )

        summaries.sort(key=lambda s: (s.count, s.max_confidence), reverse=True)
        return summaries


# Global singleton instance initialized once on FastAPI startup
detector = IngredientDetector()
