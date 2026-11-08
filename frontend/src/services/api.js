/**
 * Fridge2Food — Axios API Client
 * Communicates exclusively with the Node.js / Express backend (`/api`).
 */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 65000,
});

/**
 * Resolve a session-scoped relative image URL (`/api/session/...`) into a full URL.
 */
export function resolveSessionImageUrl(relativeUrl) {
  if (!relativeUrl) return "";
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://") || relativeUrl.startsWith("blob:")) {
    return relativeUrl;
  }
  return `${BACKEND_ORIGIN}${relativeUrl}`;
}

/**
 * Extract a clean, human-readable error message from an Axios error object.
 */
export function extractErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error?.code === "ERR_NETWORK") {
    return "Cannot connect to the Fridge2Food Express backend (http://localhost:5000). Please make sure the backend server is running.";
  }
  return error?.message || fallback;
}

/**
 * GET /api/health
 */
export async function fetchSystemHealth() {
  const response = await apiClient.get("/health");
  return response.data;
}

/**
 * POST /api/detect
 * Uploads one or more images and runs YOLO11s object detection.
 *
 * @param {File[]} files
 * @param {object} options
 * @param {string} [options.sessionId]
 * @param {string} [options.uploadMode] - "multi" or "fridge"
 * @param {number} [options.confidence]
 * @param {function} [options.onProgress] - Callback receiving integer percentage 0-100
 */
export async function uploadAndDetectImages(files, options = {}) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  if (options.sessionId) {
    formData.append("sessionId", options.sessionId);
  }
  if (options.uploadMode) {
    formData.append("uploadMode", options.uploadMode);
  }
  if (typeof options.confidence === "number") {
    formData.append("confidence", String(options.confidence));
  }

  const response = await apiClient.post("/detect", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (options.onProgress && progressEvent.total) {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        options.onProgress(percent);
      }
    },
  });

  return response.data;
}

/**
 * GET /api/session/:sessionId/ingredients
 */
export async function fetchSessionState(sessionId) {
  const response = await apiClient.get(`/session/${sessionId}/ingredients`);
  return response.data;
}

/**
 * PUT /api/session/:sessionId/ingredients
 */
export async function saveSessionIngredients(sessionId, ingredients, confirmed = false) {
  const targetId = sessionId || "sp_newsession0000";
  const response = await apiClient.put(`/session/${targetId}/ingredients`, {
    ingredients,
    confirmed,
  });
  return response.data;
}

/**
 * DELETE /api/session/:sessionId/images/:imageId
 */
export async function removeSessionImage(sessionId, imageId) {
  const response = await apiClient.delete(
    `/session/${sessionId}/images/${imageId}`
  );
  return response.data;
}

/**
 * POST /api/recipes/suggest (Stage 1 Gemini API call)
 */
export async function requestRecipeSuggestions({
  sessionId,
  ingredients,
  confirmed = true,
  preferences = {},
}) {
  const response = await apiClient.post("/recipes/suggest", {
    sessionId,
    ingredients,
    confirmed,
    preferences,
  });
  return response.data;
}

/**
 * POST /api/recipes/:recipeId/instructions (Stage 2 Gemini API call with session caching)
 */
export async function requestRecipeInstructions({
  recipeId,
  sessionId,
  recipe,
  ingredients,
}) {
  const response = await apiClient.post(`/recipes/${recipeId}/instructions`, {
    sessionId,
    recipe,
    ingredients,
  });
  return response.data;
}

/**
 * DELETE /api/session/:sessionId
 */
export async function deleteSessionOnServer(sessionId) {
  const response = await apiClient.delete(`/session/${sessionId}`);
  return response.data;
}

export default apiClient;
