"""
Automated unit & integration tests for the Fridge2Food FastAPI Inference Service.
Run with:
    pytest
"""

import io
import numpy as np
import torch
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.detector import detector, format_ingredient_name


class DummyBoxes:
    """Mock Ultralytics Boxes object for deterministic unit testing without .pt file."""

    def __init__(self):
        self.xyxy = torch.tensor([[40.0, 50.0, 220.0, 240.0], [260.0, 80.0, 410.0, 300.0]])
        self.conf = torch.tensor([0.92, 0.78])
        self.cls = torch.tensor([0.0, 1.0])

    def __len__(self):
        return 2


class DummyResult:
    """Mock Ultralytics Result object exposing dynamic `result.names`."""

    def __init__(self):
        self.names = {0: "tomato", 1: "red_onion", 2: "potato"}
        self.boxes = DummyBoxes()


class DummyModel:
    """Mock YOLO11s model used to verify `/predict` contract when weights are mocked."""

    names = {0: "tomato", 1: "red_onion", 2: "potato"}

    def predict(self, source, imgsz=640, conf=0.40, iou=0.45, device="cpu", verbose=False):
        return [DummyResult()]


def create_test_image_bytes(fmt: str = "JPEG", size=(640, 480)) -> bytes:
    img = Image.fromarray(np.zeros((size[1], size[0], 3), dtype=np.uint8))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_format_ingredient_name():
    assert format_ingredient_name("bell_pepper") == "Bell Pepper"
    assert format_ingredient_name("red-onion") == "Red Onion"
    assert format_ingredient_name("tomato") == "Tomato"


def test_health_endpoint():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert "model_loaded" in body
    assert body["confidence_threshold"] == 0.40
    assert body["image_size"] == 640


def test_predict_multiple_images_with_mock_model():
    detector.model = DummyModel()
    detector.is_loaded = True
    detector.class_names = DummyModel.names

    client = TestClient(app)
    img1 = create_test_image_bytes("JPEG", (640, 480))
    img2 = create_test_image_bytes("PNG", (800, 600))

    res = client.post(
        "/predict",
        files=[
            ("files", ("tomatoes.jpg", img1, "image/jpeg")),
            ("files", ("fridge.png", img2, "image/png")),
        ],
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total_images"] == 2
    assert data["successful_images"] == 2
    assert data["total_detections"] == 4
    assert len(data["results"]) == 2
    assert data["results"][0]["dimensions"]["width"] == 640
    assert data["results"][0]["dimensions"]["height"] == 480
    assert data["results"][0]["detections"][0]["display_name"] == "Tomato"
    assert len(data["aggregated_ingredients"]) == 2


def test_reject_invalid_image():
    detector.model = DummyModel()
    detector.is_loaded = True

    client = TestClient(app)
    res = client.post(
        "/predict",
        files=[("files", ("corrupt.jpg", b"not-an-image", "image/jpeg"))],
    )
    assert res.status_code == 400
