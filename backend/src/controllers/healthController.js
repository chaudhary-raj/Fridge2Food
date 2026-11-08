/**
 * Health Controller — Reports Express backend readiness, Gemini configuration status,
 * and FastAPI YOLO11s inference service health.
 */

const config = require("../config");
const inferenceClient = require("../services/inferenceClient");
const geminiService = require("../services/geminiService");

async function getHealth(req, res, next) {
  try {
    const inferenceHealth = await inferenceClient.checkHealth();
    res.status(200).json({
      success: true,
      service: "Fridge2Food — Node.js Express Backend",
      status: "healthy",
      timestamp: new Date().toISOString(),
      geminiConfigured: geminiService.isConfigured(),
      geminiModel: config.geminiModel,
      uploadLimits: {
        maxUploadSizeBytes: config.maxUploadSize,
        maxUploadCount: config.maxUploadCount,
        allowedFormats: Array.from(config.allowedExtensions),
      },
      inferenceService: inferenceHealth,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHealth,
};
