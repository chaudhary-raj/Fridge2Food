# Fridge2Food

Fridge2Food helps you turn food you have at home into meal ideas. Upload a photo to find ingredients, review the list, and get recipe suggestions with step-by-step cooking instructions.

## Architecture

The app has three services that run locally:

```text
Browser (React + Vite :5173)
          |
          | /api requests
          v
Node.js + Express backend (:5000)
      |                    |
      | images             | confirmed ingredients
      v                    v
FastAPI + YOLO (:8000)   Gemini API
 ingredient results       recipes and instructions
```

The frontend handles the pages and user interactions. The Express backend coordinates uploads, sessions, and recipe requests. The Python service runs the food detection model. Gemini generates recipe ideas and cooking instructions.

## How it works

1. Upload one or more food photos.
2. The backend checks the image files and sends them to the Python detection service.
3. YOLO returns ingredient labels, confidence scores, and image regions. The backend saves uploaded images temporarily and combines duplicate ingredients.
4. Review the detected ingredients. Add, remove, or edit items, then confirm the list.
5. The backend asks Gemini for recipe suggestions based on the confirmed ingredients and any preferences.
6. Choose a recipe to request its full cooking instructions.
7. Clear the session when finished; its temporary images are deleted.

## Backend logic

The backend is the central API between the browser, the detection service, and Gemini:

- **Image uploads:** Accepts JPG, JPEG, PNG, and WEBP files, checks their file contents, and enforces upload limits before forwarding them to FastAPI.
- **Ingredient detection:** Sends images to FastAPI's `/predict` endpoint and returns per-image detections and a combined ingredient list.
- **Session management:** Keeps each session's ingredients, image details, recipe suggestions, and generated instructions together. Uploaded images are stored under `backend/temp_sessions/` and served through session endpoints rather than exposing disk paths.
- **Ingredient editing:** Saves the user's ingredient changes and confirmation state. New detections require the list to be confirmed again before recipe suggestions can be requested.
- **Two-stage recipe generation:** Generates recipe cards first. Full instructions are generated only when a recipe is selected, then cached for that session to avoid repeat requests.
- **Temporary data:** Sessions expire after the configured lifetime (one hour by default). Session data is held in backend memory, so restarting the backend clears sessions; temporary files are cleaned up when sessions are cleared or expire.
- **API key handling:** The Gemini key is read by the backend from `backend/.env`; it is not sent to the frontend.

The API is available under `/api` and `/api/v1`. Main endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check backend, Gemini configuration, and detection-service status |
| `POST` | `/api/detect` | Upload images and detect ingredients |
| `GET` / `PUT` | `/api/session/:sessionId/ingredients` | Read or update ingredients and confirmation |
| `GET` / `DELETE` | `/api/session/:sessionId/images/:imageId` | View or remove a session image |
| `DELETE` | `/api/session/:sessionId` | Clear a session and its temporary images |
| `POST` | `/api/recipes/suggest` | Generate recipe suggestions |
| `POST` | `/api/recipes/:recipeId/instructions` | Generate or retrieve cooking instructions |

## What you need

- Python 3.10 or newer
- Node.js 18 or newer
- A Gemini API key for recipe suggestions
- The food detection model file: `fridge_to_plate_yolo11s.pt`

## Setup

Open PowerShell in the project folder.

1. Put the model file in `models\fridge_to_plate_yolo11s.pt`.
2. Set up the Python service:

   ```powershell
   cd .\inference-service
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   cd ..
   ```

3. Install the backend and frontend packages:

   ```powershell
   cd .\backend
   npm install
   cd ..\frontend
   npm install
   cd ..
   ```

4. Add your Gemini API key to `backend\.env`:

   ```ini
   GEMINI_API_KEY=your_api_key
   ```

## Run the app

Start each service in its own PowerShell window:

```powershell
# Window 1: from the project folder
cd .\inference-service
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```powershell
# Window 2: from the project folder
cd .\backend
npm start
```

```powershell
# Window 3: from the project folder
cd .\frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You can also start all three services with `.\scripts\start-all.ps1`.

## Run tests

```powershell
cd .\backend
npm test
cd ..\inference-service
.\.venv\Scripts\Activate.ps1
pytest
```
