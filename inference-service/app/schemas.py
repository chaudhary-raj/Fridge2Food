"""
Pydantic data models for the Fridge2Food FastAPI Computer Vision Inference Service.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Axis-aligned bounding box in both pixel coordinates and normalized [0..1] coordinates."""

    x1: float = Field(..., description="Left X coordinate in original image pixels")
    y1: float = Field(..., description="Top Y coordinate in original image pixels")
    x2: float = Field(..., description="Right X coordinate in original image pixels")
    y2: float = Field(..., description="Bottom Y coordinate in original image pixels")
    width: float = Field(..., description="Box width in pixels")
    height: float = Field(..., description="Box height in pixels")
    normalized: List[float] = Field(
        ...,
        description="Normalized [x1_norm, y1_norm, x2_norm, y2_norm] relative to image width and height",
    )


class DetectionItem(BaseModel):
    """Single detected food ingredient instance."""

    detection_id: str = Field(..., description="Unique identifier for this detection")
    class_id: int = Field(..., description="Class index from YOLO11s model")
    class_name: str = Field(..., description="Raw class name from result.names")
    display_name: str = Field(..., description="Human-friendly formatted ingredient name")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Detection confidence score between 0 and 1"
    )
    confidence_percentage: float = Field(
        ..., ge=0.0, le=100.0, description="Detection confidence formatted as percentage"
    )
    bbox: BoundingBox = Field(..., description="Bounding box coordinates in original image space")


class ImageDimensions(BaseModel):
    """Original uploaded image dimensions in pixels."""

    width: int = Field(..., gt=0, description="Original image width in pixels")
    height: int = Field(..., gt=0, description="Original image height in pixels")


class ImagePredictionResult(BaseModel):
    """Detection outcome for a single uploaded image."""

    image_index: int = Field(..., description="0-based index of the image in the batch request")
    filename: str = Field(..., description="Original uploaded filename")
    success: bool = Field(..., description="Whether inference succeeded for this image")
    dimensions: Optional[ImageDimensions] = Field(
        default=None, description="Original image width and height in pixels"
    )
    detections: List[DetectionItem] = Field(
        default_factory=list, description="List of detected food ingredients in this image"
    )
    detection_count: int = Field(default=0, description="Total detections in this image")
    inference_time_ms: float = Field(
        default=0.0, description="Time spent running inference on this image in milliseconds"
    )
    error: Optional[str] = Field(
        default=None, description="Error message if this image failed validation or inference"
    )


class AggregatedIngredientSummary(BaseModel):
    """Summary of a unique ingredient aggregated across all uploaded images in the batch."""

    name: str = Field(..., description="Normalized ingredient display name")
    raw_class_name: str = Field(..., description="Original class label from YOLO model")
    count: int = Field(..., description="Total times detected across the uploaded batch")
    max_confidence: float = Field(..., description="Highest confidence score (0-1)")
    avg_confidence: float = Field(..., description="Average confidence score (0-1)")
    source_images: List[str] = Field(
        default_factory=list, description="Filenames in which this ingredient was detected"
    )


class BatchPredictResponse(BaseModel):
    """Top-level response returned by POST /predict."""

    success: bool = Field(..., description="True if batch request was processed")
    model_name: str = Field(..., description="Loaded YOLO model filename")
    device: str = Field(..., description="Execution device used (e.g., cuda:0, mps, cpu)")
    confidence_threshold: float = Field(..., description="Confidence threshold applied")
    iou_threshold: float = Field(..., description="IoU threshold applied for NMS")
    image_size: int = Field(..., description="Inference input resolution (e.g., 640)")
    total_images: int = Field(..., description="Total images submitted in the request")
    successful_images: int = Field(..., description="Number of images successfully processed")
    failed_images: int = Field(..., description="Number of images that failed validation/inference")
    total_detections: int = Field(..., description="Total bounding boxes detected across batch")
    total_inference_time_ms: float = Field(
        ..., description="Total batch processing time in milliseconds"
    )
    results: List[ImagePredictionResult] = Field(
        ..., description="Per-image detection results and bounding boxes"
    )
    aggregated_ingredients: List[AggregatedIngredientSummary] = Field(
        default_factory=list,
        description="Deduplicated summary of detected ingredients across all images",
    )


class HealthResponse(BaseModel):
    """Health check response returned by GET /health."""

    status: str = Field(..., description="Service health status ('healthy' or 'degraded')")
    service: str = Field(default="Fridge2Food — YOLO11s Inference Service")
    model_loaded: bool = Field(..., description="Whether fridge_to_plate_yolo11s.pt is loaded")
    model_path: str = Field(..., description="Configured model filename")
    model_exists: bool = Field(..., description="Whether the model weight file exists on disk")
    device: str = Field(..., description="Selected PyTorch execution device")
    cuda_available: bool = Field(..., description="Whether NVIDIA CUDA is available")
    class_count: int = Field(default=0, description="Number of classes stored in result.names")
    class_names: Dict[int, str] = Field(
        default_factory=dict, description="Dynamic class mapping read from the YOLO11s model"
    )
    confidence_threshold: float = Field(..., description="Default confidence threshold")
    iou_threshold: float = Field(..., description="Default IoU threshold")
    image_size: int = Field(..., description="Configured inference resolution")
    message: Optional[str] = Field(default=None, description="Additional status details")
