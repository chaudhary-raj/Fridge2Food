/**
 * Fridge2Food — Backend Centralized Configuration
 * Loads environment variables from `backend/.env` or root `.env` with sensible defaults.
 */

const path = require("path");
const dotenv = require("dotenv");

// Load backend/.env first, then fallback to root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toFloat = (value, fallback, min = 0.01, max = 0.99) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const config = {
  port: toInt(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

  // Gemini Configuration (kept strictly server-side)
  geminiApiKey: (process.env.GEMINI_API_KEY || "").trim(),
  geminiModel: (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim(),

  // Python FastAPI Computer Vision Service
  pythonServiceUrl: (process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000")
    .trim()
    .replace(/\/+$/, ""),
  pythonServiceTimeoutMs: toInt(process.env.PYTHON_SERVICE_TIMEOUT_MS, 60000),
  confidenceThreshold: toFloat(process.env.CONFIDENCE_THRESHOLD, 0.40, 0.01, 0.99),
  iouThreshold: toFloat(process.env.IOU_THRESHOLD, 0.45, 0.05, 0.95),

  // Session & Temporary Storage
  sessionTtlSeconds: toInt(process.env.SESSION_TTL, 3600), // 1 hour default
  sessionCleanupIntervalSeconds: toInt(process.env.SESSION_CLEANUP_INTERVAL, 300), // 5 min default
  tempStorageDir: path.resolve(
    __dirname,
    "../..",
    process.env.TEMP_STORAGE_DIR || "./temp_sessions"
  ),

  // Upload Limits & Validation
  maxUploadSize: toInt(process.env.MAX_UPLOAD_SIZE, 10 * 1024 * 1024), // 10 MB per file
  maxUploadCount: toInt(process.env.MAX_UPLOAD_COUNT, 10),
  allowedMimeTypes: new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ]),
  allowedExtensions: new Set([".jpg", ".jpeg", ".png", ".webp"]),
};

module.exports = config;
