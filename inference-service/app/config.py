"""
Configuration module for the Fridge2Food FastAPI Inference Service.
Reads environment variables with sensible defaults for local execution.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from inference-service/.env or root .env if present
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env")


class Settings:
    """Centralized settings for YOLO11s inference and FastAPI server."""

    def __init__(self) -> None:
        raw_model_path = os.getenv(
            "MODEL_PATH",
            str(ROOT_DIR / "models" / "fridge_to_plate_yolo11s.pt"),
        )
        resolved_path = Path(raw_model_path)
        if not resolved_path.is_absolute():
            resolved_path = (BASE_DIR / resolved_path).resolve()
        self.MODEL_PATH: Path = resolved_path

        self.CONFIDENCE_THRESHOLD: float = self._clamp_float(
            os.getenv("CONFIDENCE_THRESHOLD", "0.40"),
            default=0.40,
            min_val=0.01,
            max_val=0.99,
        )
        self.IOU_THRESHOLD: float = self._clamp_float(
            os.getenv("IOU_THRESHOLD", "0.45"),
            default=0.45,
            min_val=0.05,
            max_val=0.95,
        )
        self.INFERENCE_DEVICE: str = os.getenv("INFERENCE_DEVICE", "auto").strip()
        self.IMAGE_SIZE: int = int(os.getenv("IMAGE_SIZE", "640"))
        self.MAX_CONCURRENT_INFERENCES: int = max(
            1, int(os.getenv("MAX_CONCURRENT_INFERENCES", "1"))
        )
        self.MAX_UPLOAD_SIZE: int = int(
            os.getenv("MAX_UPLOAD_SIZE", str(10 * 1024 * 1024))
        )  # 10 MB default
        self.MAX_UPLOAD_COUNT: int = int(os.getenv("MAX_UPLOAD_COUNT", "10"))
        self.ALLOWED_MIME_TYPES: set[str] = {
            mime.strip().lower()
            for mime in os.getenv(
                "ALLOWED_MIME_TYPES",
                "image/jpeg,image/jpg,image/png,image/webp",
            ).split(",")
            if mime.strip()
        }
        self.ALLOWED_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".webp"}
        self.HOST: str = os.getenv("FASTAPI_HOST", "0.0.0.0")
        self.PORT: int = int(os.getenv("FASTAPI_PORT", "8000"))

    @staticmethod
    def _clamp_float(
        raw_value: str, default: float, min_val: float, max_val: float
    ) -> float:
        try:
            val = float(raw_value)
            return max(min_val, min(max_val, val))
        except (TypeError, ValueError):
            return default


settings = Settings()
