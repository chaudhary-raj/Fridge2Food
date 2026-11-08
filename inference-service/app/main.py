"""
Fridge2Food — FastAPI Computer Vision Inference Service.

Exposes:
  - GET  /health   : Reports model readiness, device (CUDA/MPS/CPU), and dynamic class list
  - POST /predict  : Accepts single or multiple uploaded images, performs YOLO11s object
                     detection, and returns per-image bounding boxes and aggregated ingredients.
"""

from contextlib import asynccontextmanager
import logging
from pathlib import Path
from typing import List, Optional

import torch
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.detector import detector
from app.schemas import BatchPredictResponse, HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("smartplate.inference")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load the fine-tuned `fridge_to_plate_yolo11s.pt` model once during FastAPI startup
    and release resources cleanly on shutdown.
    """
    logger.info("Starting Fridge2Food YOLO11s Inference Service...")
    loaded = detector.load_model()
    if loaded:
        logger.info(
            "YOLO11s model loaded and ready (%d classes on %s).",
            len(detector.class_names),
            detector.device,
        )
    else:
        logger.warning(
            "Service started in awaiting-weights mode: %s",
            detector.load_error,
        )
    yield
    logger.info("Shutting down Fridge2Food YOLO11s Inference Service...")


app = FastAPI(
    title="Fridge2Food — YOLO11s Computer Vision Inference Service",
    description=(
        "Local object detection service powered by a fine-tuned Ultralytics YOLO11s model "
        "(fridge_to_plate_yolo11s.pt) trained on a 26-class Roboflow food ingredient dataset."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return structured JSON for validation errors without leaking internal traces."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Invalid request payload sent to inference service.",
            "details": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all exception handler that prevents internal stack traces from leaking."""
    logger.exception("Unhandled error in FastAPI inference service: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "An internal error occurred in the computer vision inference service.",
        },
    )


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """
    Return the current status of the FastAPI service, PyTorch device, and YOLO11s model.
    If the model file was placed in `models/` after startup, attempts a lazy load.
    """
    if not detector.is_loaded and detector.model_path.exists():
        detector.load_model()

    return HealthResponse(
        status="healthy" if detector.is_loaded else "model_missing",
        model_loaded=detector.is_loaded,
        model_path=detector.model_path.name,
        model_exists=detector.model_path.exists(),
        device=detector.device,
        cuda_available=torch.cuda.is_available(),
        class_count=len(detector.class_names),
        class_names=detector.class_names,
        confidence_threshold=settings.CONFIDENCE_THRESHOLD,
        iou_threshold=settings.IOU_THRESHOLD,
        image_size=settings.IMAGE_SIZE,
        message=(
            "Fine-tuned YOLO11s model is loaded and ready for inference."
            if detector.is_loaded
            else detector.load_error
        ),
    )


@app.post("/predict", response_model=BatchPredictResponse, tags=["Inference"])
async def predict_ingredients(
    files: List[UploadFile] = File(
        ..., description="One or more food/fridge images (JPG, JPEG, PNG, WEBP)"
    ),
    confidence: Optional[float] = Form(
        default=None,
        description="Optional confidence threshold override (0.01 - 0.99, default 0.40)",
    ),
    iou: Optional[float] = Form(
        default=None,
        description="Optional NMS IoU threshold override (0.05 - 0.95, default 0.45)",
    ),
) -> BatchPredictResponse:
    """
    Accept single or multiple uploaded images, validate file types and sizes, and run
    object detection on every image using the loaded `fridge_to_plate_yolo11s.pt` model.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image file must be provided under the 'files' field.",
        )

    if len(files) > settings.MAX_UPLOAD_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many images uploaded ({len(files)}). Maximum allowed per request is {settings.MAX_UPLOAD_COUNT}.",
        )

    # Validate threshold overrides if provided
    conf_threshold = settings.CONFIDENCE_THRESHOLD
    if confidence is not None:
        if not (0.01 <= confidence <= 0.99):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confidence threshold must be between 0.01 and 0.99.",
            )
        conf_threshold = float(confidence)

    iou_threshold = settings.IOU_THRESHOLD
    if iou is not None:
        if not (0.05 <= iou <= 0.95):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="IoU threshold must be between 0.05 and 0.95.",
            )
        iou_threshold = float(iou)

    # Ensure model is loaded (supports hot drop-in of fridge_to_plate_yolo11s.pt without restart)
    if not detector.is_loaded:
        if not detector.load_model():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    detector.load_error
                    or "Fine-tuned YOLO11s model (fridge_to_plate_yolo11s.pt) is not available."
                ),
            )

    images_payload = []
    for upload in files:
        safe_name = Path(upload.filename or "uploaded_image.jpg").name
        ext = Path(safe_name).suffix.lower()
        content_type = (upload.content_type or "").lower()

        raw_bytes = await upload.read()

        # Check file extension / MIME before decoding
        if (
            ext not in settings.ALLOWED_EXTENSIONS
            and content_type not in settings.ALLOWED_MIME_TYPES
        ):
            # Still pass into batch processor so per-image error is cleanly reported,
            # or reject if single file
            if len(files) == 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Unsupported file format for '{safe_name}'. "
                        "Supported formats: JPG, JPEG, PNG, and WEBP."
                    ),
                )
        images_payload.append((safe_name, raw_bytes))

    try:
        results, aggregated, total_ms = detector.predict_batch(
            images_payload=images_payload,
            confidence_threshold=conf_threshold,
            iou_threshold=iou_threshold,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    successful_count = sum(1 for r in results if r.success)
    failed_count = len(results) - successful_count
    total_detections = sum(r.detection_count for r in results)

    if successful_count == 0 and len(results) > 0:
        first_error = results[0].error or "All uploaded images failed validation."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=first_error,
        )

    return BatchPredictResponse(
        success=True,
        model_name=detector.model_path.name,
        device=detector.device,
        confidence_threshold=conf_threshold,
        iou_threshold=iou_threshold,
        image_size=settings.IMAGE_SIZE,
        total_images=len(results),
        successful_images=successful_count,
        failed_images=failed_count,
        total_detections=total_detections,
        total_inference_time_ms=total_ms,
        results=results,
        aggregated_ingredients=aggregated,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
    )
