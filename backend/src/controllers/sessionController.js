/**
 * Session Controller — Handles session ingredient retrieval, editing, confirmation,
 * secure temporary image streaming, single image removal, and session cleanup.
 */

const sessionService = require("../services/sessionService");
const { isValidSessionId } = require("../utils/validators");

/**
 * GET /api/session/:sessionId/ingredients
 */
async function getSessionIngredients(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid session identifier format.",
      });
    }

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or has expired.",
      });
    }

    const publicSession = sessionService.toPublicSession(session);
    res.status(200).json({
      success: true,
      sessionId: publicSession.sessionId,
      ingredientsConfirmed: publicSession.ingredientsConfirmed,
      ingredients: publicSession.ingredients,
      images: publicSession.images,
      recipeSuggestions: publicSession.recipeSuggestions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/session/:sessionId/ingredients
 * Updates the manually edited ingredient list and optionally marks it as confirmed.
 * Can also create the session on-the-fly if a user starts by adding ingredients manually.
 */
async function updateSessionIngredients(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { ingredients, confirmed } = req.body;

    if (!Array.isArray(ingredients)) {
      return res.status(400).json({
        success: false,
        error: "Request body must include an 'ingredients' array.",
      });
    }

    // Ensure session exists (allows manual ingredient entry even before uploading an image)
    const session = await sessionService.getOrCreateSession(
      isValidSessionId(sessionId) ? sessionId : undefined
    );

    const updatedPublic = sessionService.updateIngredients(
      session.sessionId,
      ingredients,
      Boolean(confirmed)
    );

    res.status(200).json({
      success: true,
      message: confirmed
        ? "Ingredient list confirmed and ready for recipe generation."
        : "Ingredient list updated.",
      sessionId: updatedPublic.sessionId,
      ingredientsConfirmed: updatedPublic.ingredientsConfirmed,
      ingredients: updatedPublic.ingredients,
      session: updatedPublic,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/session/:sessionId/images/:imageId
 * Streams a temporary uploaded image from the session directory without exposing filesystem paths.
 */
async function getSessionImage(req, res, next) {
  try {
    const { sessionId, imageId } = req.params;
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid session identifier.",
      });
    }

    const fileRef = sessionService.getImageFileRef(sessionId, imageId);
    if (!fileRef) {
      return res.status(404).json({
        success: false,
        error: "Requested session image was not found or has expired.",
      });
    }

    res.setHeader("Content-Type", fileRef.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(fileRef.diskPath);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/session/:sessionId/images/:imageId
 * Removes a single uploaded image from the active session and deletes its temporary file.
 */
async function deleteSessionImage(req, res, next) {
  try {
    const { sessionId, imageId } = req.params;
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid session identifier.",
      });
    }

    const updatedPublic = await sessionService.removeImage(sessionId, imageId);
    if (!updatedPublic) {
      return res.status(404).json({
        success: false,
        error: "Session not found or has expired.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Image removed from session and temporary file deleted.",
      session: updatedPublic,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/session/:sessionId
 * Clears the entire session and deletes all temporary files on disk.
 */
async function clearSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid session identifier.",
      });
    }

    await sessionService.deleteSession(sessionId);

    res.status(200).json({
      success: true,
      message: "Session cleared and all temporary files have been deleted.",
      sessionId,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSessionIngredients,
  updateSessionIngredients,
  getSessionImage,
  deleteSessionImage,
  clearSession,
};
