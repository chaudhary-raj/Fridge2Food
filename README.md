<<<<<<< HEAD
# Fridge2Food — Turn Your Ingredients Into Something Delicious

Fridge2Food is a complete, production-minded full-stack web application that detects food ingredients from uploaded photos using your fine-tuned **Ultralytics YOLO11s** object detection model (`fridge_to_plate_yolo11s.pt`) and generates personalized recipes and interactive step-by-step cooking guides using a **Two-Stage Gemini API** architecture.

---

## 1. Project Architecture

Fridge2Food runs locally across three decoupled services:

```text
+-------------------------------------------------------------------------+
|                        React + Vite + Tailwind CSS                      |
|                    Frontend UI (http://localhost:5173)                  |
|   - Landing Page, Dual-Mode Image Uploader (Multi-Image & Fridge Photo) |
|   - SVG Bounding-Box Viewer (Original vs. Annotated Toggle + Zoom)      |
|   - Editable Ingredient List & Confirmation Workflow                    |
|   - Filterable Recipe Cards & Step-by-Step Interactive Cooking Mode     |
+------------------------------------+------------------------------------+
                                     | HTTP REST (/api/*)
                                     v
+-------------------------------------------------------------------------+
|                       Node.js + Express.js Backend                      |
|                     API Server (http://localhost:5000)                  |
|   - Multer + Magic-Byte File Validation (JPG, JPEG, PNG, WEBP)          |
|   - Ephemeral Session Storage (`temp_sessions/<sessionId>`) with TTL    |
|   - Ingredient Deduplication & Source-of-Truth Management               |
|   - Server-Side Gemini API SDK (`GEMINI_API_KEY` never exposed to UI)   |
|     * Stage 1: `POST /api/recipes/suggest` (5-8 cards, no steps)        |
|     * Stage 2: `POST /api/recipes/:id/instructions` (cached per session)|
+------------------------------------+------------------------------------+
                                     | HTTP Multipart (`POST /predict`, `GET /health`)
                                     v
+-------------------------------------------------------------------------+
|               Python + FastAPI Computer Vision Service                  |
|                  Inference Server (http://127.0.0.1:8000)               |
|   - Loads `models/fridge_to_plate_yolo11s.pt` ONCE at startup           |
|   - Dynamic class mapping from `result.names` (26-class Roboflow model) |
|   - Aspect-ratio preserving 640x640 inference via Ultralytics YOLO      |
|   - `torch.inference_mode()` + BoundedSemaphore concurrency protection  |
|   - Automatic GPU (`cuda:0` / `mps`) or `cpu` execution fallback        |
+-------------------------------------------------------------------------+
```

### Folder Structure

```text
SmartPlate-AI/
├── frontend/                  # React + Vite + Tailwind CSS + Lucide Icons
│   ├── public/
│   ├── src/
│   │   ├── components/        # Navbar, Footer, ImageUploader, AnnotatedImageViewer, IngredientEditor, RecipeCard
│   │   ├── context/           # SessionContext.jsx (end-to-end session & API state)
│   │   ├── hooks/             # useSessionState.js
│   │   ├── pages/             # LandingPage, DetectionPage, RecipesPage, CookingPage
│   │   ├── services/          # api.js (Axios client with upload progress)
│   │   ├── styles/            # index.css (Tailwind directives)
│   │   ├── utils/             # colors.js (bounding-box color palette & helpers)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── backend/                   # Node.js + Express + Multer + Axios + Gemini API
│   ├── src/
│   │   ├── config/            # index.js (env variables & defaults)
│   │   ├── controllers/       # healthController, detectionController, sessionController, recipeController
│   │   ├── middleware/        # upload.js (Multer + magic bytes), errorHandler.js
│   │   ├── routes/            # apiRoutes.js (/api and /api/v1)
│   │   ├── services/          # sessionService.js, inferenceClient.js, geminiService.js
│   │   ├── utils/             # validators.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   └── api.test.js
│   ├── .env.example
│   └── package.json
├── inference-service/         # Python + FastAPI + Ultralytics YOLO11s + PyTorch + OpenCV + Pillow
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── detector.py        # Singleton YOLO11s model loader & batch predictor
│   │   ├── main.py            # FastAPI lifespan, /health, and /predict endpoints
│   │   └── schemas.py         # Pydantic response contracts
│   ├── tests/
│   │   └── test_inference.py
│   ├── .env.example
│   └── requirements.txt
├── models/
│   └── README.md              # Instructions for placing `fridge_to_plate_yolo11s.pt`
├── scripts/
│   ├── start-all.ps1          # Windows PowerShell launcher for all 3 services
│   └── start-all.sh           # Linux/macOS launcher script
├── .env.example
├── .gitignore
└── README.md
```

---

## 2. Prerequisites

Ensure the following tools are installed on your Windows machine:

- **Python**: `3.10` or `3.11` (64-bit recommended; ensure **Add Python to PATH** is checked during installation)
- **Node.js**: `v18.18+` or `v20+` LTS (includes `npm`)
- **Fine-Tuned YOLO11s Weights**: Your exported `fridge_to_plate_yolo11s.pt` file trained on Roboflow (`yolo-training-uygwi/ingredients-p3tk0`, v1, YOLOv11, 640×640)
- **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)
- *(Optional)* **NVIDIA CUDA GPU Drivers**: If you have an NVIDIA GPU, PyTorch will automatically use `cuda:0`; otherwise the service runs smoothly on `cpu`.

Verify your installed versions in **Windows PowerShell**:

```powershell
python --version
node --version
npm --version
```

---

## 3. Python Environment Setup

Open **Windows PowerShell** in the project root (`SmartPlate-AI`) and create an isolated virtual environment for the FastAPI computer vision service:

```powershell
cd .\inference-service

# Create a Python virtual environment named .venv
python -m venv .venv

# Activate the virtual environment in Windows PowerShell
.\.venv\Scripts\Activate.ps1

# If PowerShell blocks script execution, run this once in your current session:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Upgrade pip and install all computer vision dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

cd ..
```

> **GPU Note (Optional):** If you have an NVIDIA GPU and want CUDA-accelerated inference on Windows, install PyTorch with CUDA support before or after `requirements.txt`:
> ```powershell
> pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
> ```

---

## 4. Node.js Installation

Install dependencies for both the **Express backend** and the **React + Vite frontend** using Windows PowerShell:

```powershell
# 1. Install Express backend packages
cd .\backend
npm install
cd ..

# 2. Install React frontend packages
cd .\frontend
npm install
cd ..
```

---

## 5. Model Placement

Place your fine-tuned YOLO11s model file (`fridge_to_plate_yolo11s.pt`) inside the `models/` folder:

```text
SmartPlate-AI/models/fridge_to_plate_yolo11s.pt
```

In Windows PowerShell:

```powershell
# Copy your exported model file into .\models\
Copy-Item "C:\path\to\your\fridge_to_plate_yolo11s.pt" -Destination ".\models\fridge_to_plate_yolo11s.pt"

# Verify the file is in place
Test-Path .\models\fridge_to_plate_yolo11s.pt
```

- **No Generic Fallback or Hardcoded Classes:** The FastAPI service loads `fridge_to_plate_yolo11s.pt` once on startup and reads all 26 ingredient class names dynamically from `result.names` (`model.names`).
- **Hot Drop-In Supported:** If you start the FastAPI server before copying `fridge_to_plate_yolo11s.pt`, `/health` reports `"status": "model_missing"`. Once you place the file in `models/`, the next `/health` or `/predict` call automatically loads the weights without requiring a server restart.

---

## 6. Environment Configuration

Copy the `.env.example` files into `.env` files for each service in Windows PowerShell:

```powershell
Copy-Item .\.env.example .\.env
Copy-Item .\backend\.env.example .\backend\.env
Copy-Item .\inference-service\.env.example .\inference-service\.env
Copy-Item .\frontend\.env.example .\frontend\.env
```

### Supported Configuration Variables

| Variable | Default Value | Service | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | *(required)* | `backend` | Your Google Gemini API key (kept strictly server-side). |
| `GEMINI_MODEL` | `gemini-2.5-flash` | `backend` | Gemini model used for Stage 1 & Stage 2 recipe generation. |
| `MODEL_PATH` | `../models/fridge_to_plate_yolo11s.pt` | `inference-service` | Path to your fine-tuned YOLO11s `.pt` weights. |
| `CONFIDENCE_THRESHOLD` | `0.40` | `both` | Default minimum detection confidence score (`0.01`–`0.99`). |
| `IOU_THRESHOLD` | `0.45` | `both` | Non-Maximum Suppression (NMS) IoU threshold (`0.05`–`0.95`). |
| `INFERENCE_DEVICE` | `auto` | `inference-service` | `auto` (picks `cuda:0` &rarr; `mps` &rarr; `cpu`), `cpu`, or `cuda:0`. |
| `PYTHON_SERVICE_URL` | `http://127.0.0.1:8000` | `backend` | URL where the FastAPI inference service is listening. |
| `PORT` | `5000` | `backend` | Port for the Node.js Express backend server. |
| `SESSION_TTL` | `3600` | `backend` | Session lifetime in seconds before automatic file cleanup (1 hour). |
| `MAX_UPLOAD_SIZE` | `10485760` | `both` | Max file size per uploaded image in bytes (10 MB). |
| `MAX_UPLOAD_COUNT` | `10` | `both` | Maximum number of images accepted per upload batch. |

---

## 7. How to Start the FastAPI Service

Open **Terminal 1 (Windows PowerShell)**:

```powershell
cd .\inference-service
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verify it is running by visiting `http://127.0.0.1:8000/health` or running:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" | ConvertTo-Json -Depth 4
```

---

## 8. How to Start the Express Backend

Open **Terminal 2 (Windows PowerShell)**:

```powershell
cd .\backend
npm start
```

Verify the backend health endpoint (`http://localhost:5000/api/health`):

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health" | ConvertTo-Json -Depth 4
```

---

## 9. How to Start the React Frontend

Open **Terminal 3 (Windows PowerShell)**:

```powershell
cd .\frontend
npm run dev
```

Open your browser to **[http://localhost:5173](http://localhost:5173)**.

### One-Command Multi-Service Launch (Windows PowerShell)

To launch all three services simultaneously in separate PowerShell windows:

```powershell
.\scripts\start-all.ps1
```

---

## 10. How to Obtain and Configure the Gemini API Key

1. Visit **[Google AI Studio](https://aistudio.google.com/app/apikey)** and sign in with your Google account.
2. Click **Create API Key** and copy the generated key string.
3. Open `backend/.env` in your code editor and set:
   ```ini
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   GEMINI_MODEL=gemini-2.5-flash
   ```
4. Save `backend/.env` and restart the Express backend (`npm start` in `backend/`).
5. **Security Guarantee:** `GEMINI_API_KEY` is read exclusively by `backend/src/config/index.js`. It is never bundled into or exposed to the React frontend.

---

## 11. How to Test Image Detection

You can test object detection through the web UI at `http://localhost:5173/detect` or directly via PowerShell:

```powershell
# Test FastAPI /predict directly with curl.exe in PowerShell
curl.exe -X POST "http://127.0.0.1:8000/predict" `
  -F "files=@C:\path\to\tomatoes.jpg" `
  -F "files=@C:\path\to\onions.jpg" `
  -F "confidence=0.40"

# Test Express /api/detect (which stores session images and merges ingredients)
curl.exe -X POST "http://localhost:5000/api/detect" `
  -F "images=@C:\path\to\fridge_photo.jpg" `
  -F "uploadMode=fridge" `
  -F "confidence=0.40"
```

---

## 12. How to Test Recipe Suggestions (Gemini Stage 1)

Stage 1 requires a confirmed ingredient list and returns **5–8 recipe suggestions** without cooking steps:

```powershell
$body = @{
  sessionId = "sp_testsession12345"
  confirmed = $true
  ingredients = @(
    @{ name = "Tomato"; quantity = "3 units"; count = 3 },
    @{ name = "Onion"; quantity = "2 units"; count = 2 },
    @{ name = "Potato"; quantity = "4 units"; count = 4 }
  )
  preferences = @{
    cuisine = "Mediterranean"
    dietary = "Vegetarian"
  }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/api/recipes/suggest" `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 5
```

---

## 13. How to Test Detailed Recipe Generation (Gemini Stage 2)

Stage 2 is called **only** when a user clicks **Make This Recipe** on a card (`POST /api/recipes/:recipeId/instructions`). Repeated calls for the same `recipeId` within the same `sessionId` return `"cached": true` immediately without calling Gemini again:

```powershell
# Replace <recipeId> and <sessionId> with values from the Stage 1 response
$stage2Body = @{
  sessionId = "sp_testsession12345"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/api/recipes/<recipeId>/instructions" `
  -ContentType "application/json" `
  -Body $stage2Body | ConvertTo-Json -Depth 6
```

---

## 14. Testing All 15 End-to-End Workflows

Run the automated test suites first:

```powershell
# 1. Run Python FastAPI unit & integration tests
cd .\inference-service
.\.venv\Scripts\Activate.ps1
pytest -v
cd ..

# 2. Run Node.js Express backend unit & session lifecycle tests
cd .\backend
npm test
cd ..
```

### Interactive 15-Workflow Verification Checklist

1. **Upload one food image**: Go to `/detect`, drag in a single photo (e.g., `tomatoes.jpg`), and click **Detect Ingredients (1)**.
2. **Upload multiple individual images**: Switch to **Multiple Individual Images**, select 3 separate photos (`tomatoes.jpg`, `onions.jpg`, `potatoes.jpg`), preview them in the staging grid, and click **Detect Ingredients (3)**.
3. **Upload one image containing multiple ingredients**: Switch to **Single Fridge Image**, upload a photo of a stocked fridge or countertop, and click **Detect Ingredients (1)** within the same session.
4. **Detect multiple objects in one image**: Select the fridge thumbnail in the **Visual Detection Results** viewer and confirm multiple bounding boxes appear simultaneously.
5. **Display bounding boxes and confidence scores**: Toggle between **Annotated View** and **Original Image**, and click **Zoom / Expand** to inspect scaled bounding boxes and confidence percentages (`e.g., Tomato 94.2%`).
6. **Add, edit, and remove ingredients**: In the right-hand **Detected & Editable Ingredients** panel:
   - Type `Garlic` (`4 cloves`) and click **Add**.
   - Click the pencil icon next to any detected item to rename it or change its quantity.
   - Use the `+` / `-` buttons to adjust counts, or click the trash icon to remove an item.
   - Verify duplicate ingredient names across images are merged into one entry showing total count and source image filenames.
7. **Confirm the final ingredient list**: Click **Confirm Ingredients & Find Recipes**.
8. **Generate 5–8 recipe suggestions**: Verify `/recipes` displays 5–8 tailored recipe cards with cuisine, difficulty, prep/cook times, ingredient match percentage, matched ingredients, and additional required items.
9. **Verify suggestions do not contain cooking steps**: Inspect the recipe cards and `/api/recipes/suggest` network payload—no step-by-step instructions are generated at Stage 1.
10. **Click Make This Recipe**: Click **Make This Recipe** on any card.
11. **Generate detailed cooking instructions**: Verify `/cook/:recipeId` loads exact measurements, available vs. additional ingredients, preparation (`mise en place`) instructions, numbered steps with times and heat levels, chef tips, substitutions, and serving suggestions.
12. **Navigate through cooking steps**: Use **Previous** and **Next Step**, check off items in the **Ingredient Checklist**, and watch the progress bar update.
13. **Verify session caching**: Click **Back to Recipe Suggestions** and click **Open Cooking Guide (Cached)** on the same recipe card—verify it opens instantaneously without making a second Gemini API call.
14. **Clear the session and confirm temporary files are deleted**: Click **Clear Session** in the top navigation bar and verify that `backend/temp_sessions/<sessionId>` is deleted from disk.
15. **Handle invalid images and unavailable services**: Try uploading a renamed `.txt` file as `.jpg` (rejected by magic-byte validation) or stop the FastAPI server and verify a clear, actionable error banner appears.

---

## 15. Troubleshooting Common Errors

| Symptom / Error Message | Cause | Solution |
| :--- | :--- | :--- |
| `Fine-tuned YOLO11s model file not found at 'fridge_to_plate_yolo11s.pt'` | The `.pt` weights have not been placed in `models/` yet. | Copy your `fridge_to_plate_yolo11s.pt` into `SmartPlate-AI/models/` (or update `MODEL_PATH` in `inference-service/.env`). |
| `Computer vision inference service is unavailable at http://127.0.0.1:8000` | The Python FastAPI service is not running. | Start FastAPI in `inference-service/` using `uvicorn app.main:app --host 0.0.0.0 --port 8000`. |
| `GEMINI_API_KEY is missing or set to the placeholder value` | `backend/.env` still has `your_gemini_api_key_here`. | Paste your real Gemini API key into `backend/.env` and restart `npm start` in `backend/`. |
| `CUDA requested (cuda:0) but torch.cuda.is_available() is False` | PyTorch CPU build is installed or no NVIDIA GPU is present. | Leave `INFERENCE_DEVICE=auto` or set `INFERENCE_DEVICE=cpu` in `inference-service/.env`. |
| PowerShell `Activate.ps1 cannot be loaded because running scripts is disabled` | Windows PowerShell default execution policy restriction. | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in PowerShell, then re-run `.\.venv\Scripts\Activate.ps1`. |
=======
# Fridge2Food
>>>>>>> 1176bbabbc84e6074691b15492e1aef6c44a92a1
