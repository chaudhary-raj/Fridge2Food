#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "====================================================="
echo "   Fridge2Food — Local Multi-Service Launcher      "
echo "====================================================="

if [ ! -f "$ROOT_DIR/models/fridge_to_plate_yolo11s.pt" ]; then
  echo "[WARNING] Model file not found at $ROOT_DIR/models/fridge_to_plate_yolo11s.pt"
  echo "          Place your fridge_to_plate_yolo11s.pt weights in models/ before running detection."
fi

cleanup() {
  echo ""
  echo "Shutting down Fridge2Food services..."
  kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[1/3] Starting Python FastAPI Inference Service on port 8000..."
(
  cd "$ROOT_DIR/inference-service"
  if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
  fi
  uvicorn app.main:app --host 0.0.0.0 --port 8000
) &

sleep 2

echo "[2/3] Starting Node.js Express Backend on port 5000..."
(
  cd "$ROOT_DIR/backend"
  npm start
) &

sleep 2

echo "[3/3] Starting React Vite Frontend on port 5173..."
(
  cd "$ROOT_DIR/frontend"
  npm run dev
) &

wait
