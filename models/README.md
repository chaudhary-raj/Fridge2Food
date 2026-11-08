# Fridge2Food — Fine-Tuned YOLO11s Model Directory

## Required Model File

Place your fine-tuned Ultralytics YOLO11s object detection weights in this directory with the exact filename:

```text
Fridge2Food/models/fridge_to_plate_yolo11s.pt
```

> **Important:** No placeholder or fabricated `.pt` file is included in this repository. The FastAPI inference service loads `fridge_to_plate_yolo11s.pt` directly from this path (or the path configured in `MODEL_PATH`) during application startup.

---

## Model Training Specifications

This application is architected specifically around the following fine-tuned YOLO11s model configuration:

| Parameter | Value |
| :--- | :--- |
| **Model Filename** | `fridge_to_plate_yolo11s.pt` |
| **Task** | Object Detection (26-class food ingredient detection) |
| **Roboflow Project** | `yolo-training-uygwi/ingredients-p3tk0` |
| **Dataset Version** | Version `1` (YOLOv11 format) |
| **Base Architecture** | `yolo11s.pt` (Ultralytics YOLO11 Small) |
| **Training Image Size** | `640 × 640` |
| **Stage 1 Training** | `25` epochs, batch size `16`, freeze `10`, learning rate `0.01` |
| **Stage 2 Training** | `30` epochs, batch size `16`, freeze `0`, learning rate `0.001` |
| **Training Hardware** | Google Colab NVIDIA T4 GPU |

---

## How the Inference Service Uses This Model

1. **Single Startup Load:** `inference-service/app/detector.py` loads `fridge_to_plate_yolo11s.pt` once when FastAPI starts using lifespan management and reuses the in-memory model across all requests.
2. **Dynamic Class Mapping:** Class labels are read dynamically from the model metadata (`model.names` / `result.names`) rather than hardcoding class indices.
3. **Aspect-Ratio Preserving Inference:** Images are passed to Ultralytics YOLO at `imgsz=640` using standard letterbox scaling without manual aspect-ratio distortion, and bounding boxes (`[x1, y1, x2, y2]`) are automatically mapped back to the original image dimensions.
4. **Inference Mode & Device Selection:** Predictions execute inside `with torch.inference_mode():` with a thread/async lock to prevent uncontrolled concurrent GPU memory spikes, automatically using CUDA (`cuda:0`), Apple Silicon (`mps`), or CPU (`cpu`) based on `INFERENCE_DEVICE`.

---

## Quick Verification

After placing `fridge_to_plate_yolo11s.pt` in this folder, verify the file exists using Windows PowerShell:

```powershell
Test-Path .\models\fridge_to_plate_yolo11s.pt
Get-Item .\models\fridge_to_plate_yolo11s.pt | Select-Object Name, Length, LastWriteTime
```
