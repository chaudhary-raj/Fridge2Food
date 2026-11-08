<#
.SYNOPSIS
    Starts all three Fridge2Food services (FastAPI Inference Service, Express Backend, and React Vite Frontend) in separate Windows PowerShell terminals.
.DESCRIPTION
    Run from the root of the Fridge2Food directory:
    .\scripts\start-all.ps1
#>

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   Fridge2Food — Local Multi-Service Launcher      " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# Check model file presence
$ModelFile = Join-Path $RootDir "models\fridge_to_plate_yolo11s.pt"
if (-Not (Test-Path $ModelFile)) {
    Write-Host "[WARNING] Fine-tuned model file not found at: $ModelFile" -ForegroundColor Yellow
    Write-Host "          Place your 'fridge_to_plate_yolo11s.pt' in the 'models\' folder before running detection." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Found YOLO11s model weights at: $ModelFile" -ForegroundColor Green
}

# 1. Start Python FastAPI Inference Service
Write-Host "`n[1/3] Launching Python FastAPI Inference Service (Port 8000)..." -ForegroundColor Green
$InferenceDir = Join-Path $RootDir "inference-service"
$VenvActivate = Join-Path $InferenceDir ".venv\Scripts\Activate.ps1"
if (Test-Path $VenvActivate) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$InferenceDir'; & '$VenvActivate'; uvicorn app.main:app --host 0.0.0.0 --port 8000"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$InferenceDir'; uvicorn app.main:app --host 0.0.0.0 --port 8000"
}

Start-Sleep -Seconds 2

# 2. Start Node.js Express Backend
Write-Host "[2/3] Launching Node.js Express Backend (Port 5000)..." -ForegroundColor Green
$BackendDir = Join-Path $RootDir "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendDir'; npm start"

Start-Sleep -Seconds 2

# 3. Start React + Vite Frontend
Write-Host "[3/3] Launching React + Vite Frontend (Port 5173)..." -ForegroundColor Green
$FrontendDir = Join-Path $RootDir "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendDir'; npm run dev"

Write-Host "`nAll three services have been launched in separate PowerShell windows!" -ForegroundColor Cyan
Write-Host "  - Frontend UI:        http://localhost:5173" -ForegroundColor White
Write-Host "  - Express Backend:    http://localhost:5000/api/health" -ForegroundColor White
Write-Host "  - FastAPI Inference:  http://127.0.0.1:8000/health" -ForegroundColor White
