/**
 * Recipe Controller — Implements the Two-Stage Gemini Integration:
 *   1. POST /api/recipes/suggest
 *      Requires a confirmed ingredient list; calls Gemini Stage 1 to generate 5–8 recipe cards
 *      without cooking steps.
 *   2. POST /api/recipes/:recipeId/instructions
 *      Triggered only when the user clicks "Make This Recipe"; checks session cache first,
 *      otherwise calls Gemini Stage 2 to generate complete step-by-step instructions.
 */

const sessionService = require("../services/sessionService");
const geminiService = require("../services/geminiService");
const { isValidSessionId } = require("../utils/validators");

/**
 * POST /api/recipes/suggest
 */
async function suggestRecipes(req, res, next) {
  try {
    const { sessionId, ingredients, confirmed, preferences } = req.body;

    let activeSession = null;
    if (sessionId && isValidSessionId(sessionId)) {
      activeSession = sessionService.getSession(sessionId);
    }

    if (!activeSession) {
      activeSession = await sessionService.getOrCreateSession(
        isValidSessionId(sessionId) ? sessionId : undefined
      );
    }

    // If the client passed an updated ingredient list alongside confirmation, persist it first
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      sessionService.updateIngredients(
        activeSession.sessionId,
        ingredients,
        confirmed !== undefined ? Boolean(confirmed) : true
      );
    }

    // Never generate recipes automatically from unconfirmed detections
    if (!activeSession.ingredientsConfirmed) {
      return res.status(400).json({
        success: false,
        error:
          "Please review and confirm your ingredient list before generating recipe suggestions.",
      });
    }

    if (!Array.isArray(activeSession.ingredients) || activeSession.ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "Your confirmed ingredient list is empty. Add at least one ingredient to generate recipes.",
      });
    }

    const suggestions = await geminiService.generateRecipeSuggestions(
      activeSession.ingredients,
      preferences || {}
    );

    sessionService.setRecipeSuggestions(activeSession.sessionId, suggestions);

    res.status(200).json({
      success: true,
      sessionId: activeSession.sessionId,
      count: suggestions.length,
      confirmedIngredients: activeSession.ingredients,
      recipes: suggestions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/recipes/:recipeId/instructions
 */
async function getRecipeInstructions(req, res, next) {
  try {
    const { recipeId } = req.params;
    const { sessionId, recipe: fallbackRecipePayload, ingredients: fallbackIngredients } =
      req.body;

    if (!recipeId) {
      return res.status(400).json({
        success: false,
        error: "Recipe ID is required.",
      });
    }

    let activeSession = null;
    if (sessionId && isValidSessionId(sessionId)) {
      activeSession = sessionService.getSession(sessionId);
    }

    // 1. Check session cache first so repeated clicks do not unnecessarily call Gemini again
    if (activeSession) {
      const cached = sessionService.getCachedInstructions(
        activeSession.sessionId,
        recipeId
      );
      if (cached) {
        return res.status(200).json({
          success: true,
          cached: true,
          sessionId: activeSession.sessionId,
          instructions: cached,
        });
      }
    }

    // 2. Resolve the selected Stage 1 recipe card & confirmed ingredients
    let targetRecipe = activeSession
      ? sessionService.getRecipeSuggestionById(activeSession.sessionId, recipeId)
      : null;

    if (!targetRecipe && fallbackRecipePayload && fallbackRecipePayload.name) {
      targetRecipe = {
        id: recipeId,
        ...fallbackRecipePayload,
      };
    }

    if (!targetRecipe) {
      return res.status(404).json({
        success: false,
        error:
          "Selected recipe was not found in the active session. Please generate recipe suggestions first.",
      });
    }

    const confirmedIngredients =
      activeSession && activeSession.ingredients.length > 0
        ? activeSession.ingredients
        : Array.isArray(fallbackIngredients)
        ? fallbackIngredients
        : [];

    // 3. Call Gemini Stage 2 for complete step-by-step cooking instructions
    const instructions = await geminiService.generateRecipeInstructions(
      targetRecipe,
      confirmedIngredients
    );

    if (activeSession) {
      sessionService.setCachedInstructions(
        activeSession.sessionId,
        recipeId,
        instructions
      );
    }

    res.status(200).json({
      success: true,
      cached: false,
      sessionId: activeSession ? activeSession.sessionId : null,
      instructions,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  suggestRecipes,
  getRecipeInstructions,
};
