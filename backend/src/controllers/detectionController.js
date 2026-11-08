/**
 * Detection Controller — Handles POST /api/detect
 * Accepts one or more uploaded images (individual ingredient photos or a single fridge image),
 * forwards them to the Python FastAPI YOLO11s service, stores temporary files in the session,
 * and returns per-image bounding boxes plus the merged ingredient list.
 */

const inferenceClient = require("../services/inferenceClient");
const sessionService = require("../services/sessionService");

async function detectIngredients(req, res, next) {
  try {
    const files = req.files || [];
    const requestedSessionId =
      req.body.sessionId || req.headers["x-session-id"] || "";
    const uploadMode = req.body.uploadMode === "fridge" ? "fridge" : "multi";

    const confidence = req.body.confidence
      ? parseFloat(req.body.confidence)
      : undefined;
    const iou = req.body.iou ? parseFloat(req.body.iou) : undefined;

    // Forward images to Python FastAPI `/predict`
    const inferenceResult = await inferenceClient.detectIngredients(files, {
      confidence: Number.isFinite(confidence) ? confidence : undefined,
      iou: Number.isFinite(iou) ? iou : undefined,
    });

    // Record images and merge detections inside session-scoped storage
    const publicSession = await sessionService.recordDetectionBatch(
      requestedSessionId,
      files,
      inferenceResult,
      uploadMode
    );

    res.status(200).json({
      success: true,
      message: `Processed ${files.length} image(s) and detected ${inferenceResult.total_detections || 0} food item(s).`,
      sessionId: publicSession.sessionId,
      inferenceMeta: {
        modelName: inferenceResult.model_name,
        device: inferenceResult.device,
        confidenceThreshold: inferenceResult.confidence_threshold,
        iouThreshold: inferenceResult.iou_threshold,
        totalInferenceTimeMs: inferenceResult.total_inference_time_ms,
      },
      session: publicSession,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  detectIngredients,
};
