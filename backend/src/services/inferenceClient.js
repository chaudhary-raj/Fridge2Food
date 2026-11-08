/**
 * Fridge2Food — Python FastAPI Computer Vision Service HTTP Client
 *
 * Forwards uploaded images from the Express backend to the FastAPI `/predict`
 * endpoint and queries `/health` with proper timeouts and structured error handling.
 */

const axios = require("axios");
const FormData = require("form-data");
const config = require("../config");
const { sanitizeFilename } = require("../utils/validators");

class InferenceClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.pythonServiceUrl,
      timeout: config.pythonServiceTimeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }

  /**
   * Check the health and model readiness of the Python FastAPI service.
   *
   * @returns {Promise<object>}
   */
  async checkHealth() {
    try {
      const response = await this.client.get("/health", { timeout: 5000 });
      return {
        available: true,
        ...response.data,
      };
    } catch (error) {
      return {
        available: false,
        status: "unreachable",
        model_loaded: false,
        message:
          error.code === "ECONNREFUSED"
            ? `Python FastAPI service is not reachable at ${config.pythonServiceUrl}. Ensure Uvicorn is running on port 8000.`
            : `Failed to contact Python inference service: ${error.message}`,
      };
    }
  }

  /**
   * Forward one or more validated image buffers to FastAPI `POST /predict`.
   *
   * @param {Array<object>} files - Multer file objects with `buffer`, `originalname`, `mimetype`
   * @param {object} [options]
   * @param {number} [options.confidence]
   * @param {number} [options.iou]
   * @returns {Promise<object>}
   */
  async detectIngredients(files, options = {}) {
    const formData = new FormData();

    for (const file of files) {
      const safeName = sanitizeFilename(file.originalname);
      formData.append("files", file.buffer, {
        filename: safeName,
        contentType: file.mimetype || "image/jpeg",
      });
    }

    const conf =
      typeof options.confidence === "number"
        ? options.confidence
        : config.confidenceThreshold;
    const iou =
      typeof options.iou === "number" ? options.iou : config.iouThreshold;

    formData.append("confidence", String(conf));
    formData.append("iou", String(iou));

    try {
      const response = await this.client.post("/predict", formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const detail =
          error.response.data?.detail ||
          error.response.data?.error ||
          "Inference service rejected the request.";
        const wrappedError = new Error(detail);
        wrappedError.statusCode = status;
        throw wrappedError;
      }

      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        const serviceErr = new Error(
          `Computer vision inference service is unavailable at ${config.pythonServiceUrl}. Please start the Python FastAPI service first.`
        );
        serviceErr.statusCode = 503;
        throw serviceErr;
      }

      if (error.code === "ECONNABORTED") {
        const timeoutErr = new Error(
          "Image detection timed out while waiting for the YOLO11s inference service. Try uploading fewer or smaller images."
        );
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      const genericErr = new Error(
        `Failed to communicate with inference service: ${error.message}`
      );
      genericErr.statusCode = 502;
      throw genericErr;
    }
  }
}

module.exports = new InferenceClient();
