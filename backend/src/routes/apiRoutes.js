/**
 * Fridge2Food — Versioned REST API Routes
 * Mounted at both `/api` and `/api/v1` for clean versioning.
 */

const express = require("express");
const { getHealth } = require("../controllers/healthController");
const { detectIngredients } = require("../controllers/detectionController");
const {
  getSessionIngredients,
  updateSessionIngredients,
  getSessionImage,
  deleteSessionImage,
  clearSession,
} = require("../controllers/sessionController");
const {
  suggestRecipes,
  getRecipeInstructions,
} = require("../controllers/recipeController");
const { uploadImagesMiddleware } = require("../middleware/upload");

const router = express.Router();

// 1. Health Check
router.get("/health", getHealth);

// 2. Image Upload & YOLO11s Object Detection
router.post("/detect", uploadImagesMiddleware, detectIngredients);

// 3. Session & Ingredient Management
router.get("/session/:sessionId/ingredients", getSessionIngredients);
router.put("/session/:sessionId/ingredients", updateSessionIngredients);
router.get("/session/:sessionId/images/:imageId", getSessionImage);
router.delete("/session/:sessionId/images/:imageId", deleteSessionImage);
router.delete("/session/:sessionId", clearSession);

// 4. Two-Stage Gemini Recipe Generation
router.post("/recipes/suggest", suggestRecipes);
router.post("/recipes/:recipeId/instructions", getRecipeInstructions);

module.exports = router;
