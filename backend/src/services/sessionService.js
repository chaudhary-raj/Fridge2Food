/**
 * Fridge2Food — Session-Based Temporary Storage & Ingredient Management Service
 *
 * Responsibilities:
 * - Assigns each user session a unique identifier (`sessionId`)
 * - Stores uploaded images temporarily in a dedicated session-scoped directory (`temp_sessions/<sessionId>`)
 * - Never exposes raw filesystem paths to the frontend (serves images via `/api/session/:sessionId/images/:imageId`)
 * - Allows accumulating detections from both multiple individual images and single fridge photos in the same session
 * - Deduplicates and merges ingredient detections across images while preserving per-image detection metadata
 * - Tracks manual user edits (add, rename, remove, quantity adjustment, confirmation status) as the single source of truth
 * - Caches Stage 1 recipe suggestions and Stage 2 detailed cooking instructions per session
 * - Automatically cleans up expired sessions and deletes temporary files when cleared or expired
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const {
  sanitizeFilename,
  sanitizeText,
  normalizeIngredientName,
  isValidSessionId,
} = require("../utils/validators");

class SessionService {
  constructor() {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
    this.baseTempDir = config.tempStorageDir;
    this.ttlMs = config.sessionTtlSeconds * 1000;

    // Ensure base temporary directory exists
    fs.mkdirSync(this.baseTempDir, { recursive: true });

    // Background interval to clean up expired sessions & temporary files
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch((err) => {
        console.error("[SessionService] Error during scheduled cleanup:", err.message);
      });
    }, config.sessionCleanupIntervalSeconds * 1000);

    if (typeof this.cleanupTimer.unref === "function") {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Create a new session or retrieve an existing active session.
   *
   * @param {string} [requestedSessionId]
   * @returns {Promise<object>}
   */
  async getOrCreateSession(requestedSessionId) {
    if (requestedSessionId && isValidSessionId(requestedSessionId)) {
      const existing = this.sessions.get(requestedSessionId);
      if (existing && !this._isExpired(existing)) {
        existing.updatedAt = Date.now();
        existing.expiresAt = Date.now() + this.ttlMs;
        return existing;
      }
    }

    const sessionId = `sp_${uuidv4().replace(/-/g, "")}`;
    const sessionDir = path.join(this.baseTempDir, sessionId);
    await fsp.mkdir(sessionDir, { recursive: true });

    const now = Date.now();
    const session = {
      sessionId,
      sessionDir,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + this.ttlMs,
      images: [], // Per-image metadata & detections (internal filePath kept private)
      ingredients: [], // Merged & user-editable ingredient list (source of truth)
      ingredientsConfirmed: false,
      recipeSuggestions: [], // Stage 1 Gemini output
      instructionsCache: new Map(), // recipeId -> Stage 2 Gemini output
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Retrieve an active session by ID or return null if missing/expired.
   *
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSession(sessionId) {
    if (!isValidSessionId(sessionId)) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (this._isExpired(session)) {
      this.deleteSession(sessionId).catch(() => {});
      return null;
    }

    session.updatedAt = Date.now();
    session.expiresAt = Date.now() + this.ttlMs;
    return session;
  }

  /**
   * Save uploaded image buffers to the session's temporary directory and merge
   * FastAPI YOLO11s detection results into the session state.
   *
   * @param {string} sessionId
   * @param {Array<object>} uploadedFiles - Multer file objects
   * @param {object} inferenceResponse - Response from FastAPI /predict
   * @param {string} [uploadMode="multi"] - "multi" (individual items) or "fridge" (single multi-item photo)
   * @returns {Promise<object>} Sanitized public session snapshot
   */
  async recordDetectionBatch(
    sessionId,
    uploadedFiles,
    inferenceResponse,
    uploadMode = "multi"
  ) {
    const session = await this.getOrCreateSession(sessionId);
    const results = Array.isArray(inferenceResponse?.results)
      ? inferenceResponse.results
      : [];

    const newlyAddedImages = [];

    for (let idx = 0; idx < uploadedFiles.length; idx++) {
      const file = uploadedFiles[idx];
      const predResult = results[idx] || {};
      const imageId = `img_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
      const safeOriginalName = sanitizeFilename(file.originalname);
      const ext = path.extname(safeOriginalName).toLowerCase() || ".jpg";
      const storedFilename = `${imageId}${ext}`;
      const diskPath = path.join(session.sessionDir, storedFilename);

      await fsp.writeFile(diskPath, file.buffer);

      const imageEntry = {
        imageId,
        originalName: safeOriginalName,
        mimeType: file.mimetype || "image/jpeg",
        sizeBytes: file.size || file.buffer.length,
        uploadMode: uploadMode === "fridge" ? "fridge" : "individual",
        uploadedAt: new Date().toISOString(),
        diskPath, // Private — never serialized to client
        imageUrl: `/api/session/${session.sessionId}/images/${imageId}`,
        dimensions: predResult.dimensions || { width: 640, height: 640 },
        detections: Array.isArray(predResult.detections) ? predResult.detections : [],
        detectionCount: predResult.detection_count || 0,
        inferenceTimeMs: predResult.inference_time_ms || 0,
      };

      session.images.push(imageEntry);
      newlyAddedImages.push(imageEntry);
    }

    // Merge newly detected ingredients into the session's unique ingredient list
    this._mergeDetectionsIntoIngredients(session, newlyAddedImages);

    // Since new detections arrived, require user confirmation before recipe generation
    session.ingredientsConfirmed = false;
    session.updatedAt = Date.now();
    session.expiresAt = Date.now() + this.ttlMs;

    return this.toPublicSession(session);
  }

  /**
   * Merge detections from newly uploaded images into `session.ingredients`,
   * deduplicating by normalized ingredient name while preserving detection counts,
   * confidence scores, and source image references.
   *
   * @param {object} session
   * @param {Array<object>} imagesToMerge
   */
  _mergeDetectionsIntoIngredients(session, imagesToMerge) {
    const mapByName = new Map();

    // Index existing ingredients first (preserving manual edits)
    for (const item of session.ingredients) {
      const key = item.name.toLowerCase().trim();
      mapByName.set(key, item);
    }

    for (const img of imagesToMerge) {
      for (const det of img.detections) {
        const displayName = normalizeIngredientName(
          det.display_name || det.class_name || "Ingredient"
        );
        if (!displayName) continue;
        const key = displayName.toLowerCase();

        if (!mapByName.has(key)) {
          const newIng = {
            id: `ing_${uuidv4().replace(/-/g, "").slice(0, 10)}`,
            name: displayName,
            rawClassName: det.class_name || displayName.toLowerCase(),
            count: 1,
            quantity: "1 unit",
            maxConfidence: Number(det.confidence || 0),
            avgConfidence: Number(det.confidence || 0),
            confidencePercentage: Number(
              det.confidence_percentage || Math.round((det.confidence || 0) * 1000) / 10
            ),
            sourceImages: [
              {
                imageId: img.imageId,
                filename: img.originalName,
              },
            ],
            isManual: false,
            isEdited: false,
            _confidenceSum: Number(det.confidence || 0),
            _detectionTotal: 1,
          };
          session.ingredients.push(newIng);
          mapByName.set(key, newIng);
        } else {
          const existing = mapByName.get(key);
          existing.count = (existing.count || 1) + 1;
          existing._detectionTotal = (existing._detectionTotal || 1) + 1;
          existing._confidenceSum =
            (existing._confidenceSum || existing.avgConfidence || 0) +
            Number(det.confidence || 0);
          existing.maxConfidence = Math.max(
            existing.maxConfidence || 0,
            Number(det.confidence || 0)
          );
          existing.avgConfidence =
            Math.round((existing._confidenceSum / existing._detectionTotal) * 10000) /
            10000;
          existing.confidencePercentage =
            Math.round(existing.maxConfidence * 1000) / 10;

          if (!existing.isEdited) {
            existing.quantity = `${existing.count} ${
              existing.count === 1 ? "unit" : "units"
            }`;
          }

          const hasSource = existing.sourceImages.some(
            (src) => src.imageId === img.imageId
          );
          if (!hasSource) {
            existing.sourceImages.push({
              imageId: img.imageId,
              filename: img.originalName,
            });
          }
        }
      }
    }
  }

  /**
   * Remove a single uploaded image from the session and delete its temp file.
   *
   * @param {string} sessionId
   * @param {string} imageId
   * @returns {Promise<object|null>}
   */
  async removeImage(sessionId, imageId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const index = session.images.findIndex((img) => img.imageId === imageId);
    if (index === -1) return this.toPublicSession(session);

    const [removed] = session.images.splice(index, 1);
    if (removed && removed.diskPath) {
      await fsp.rm(removed.diskPath, { force: true }).catch(() => {});
    }

    // Rebuild auto-detected ingredients while keeping manually added ones
    const manualItems = session.ingredients.filter((ing) => ing.isManual);
    session.ingredients = [...manualItems];
    this._mergeDetectionsIntoIngredients(session, session.images);

    return this.toPublicSession(session);
  }

  /**
   * Update the session's ingredient list (add, edit name, adjust quantity, remove, or confirm).
   * Deduplicates ingredients with identical names so the confirmed list is clean.
   *
   * @param {string} sessionId
   * @param {Array<object>} updatedList
   * @param {boolean} [confirmed=false]
   * @returns {object|null}
   */
  updateIngredients(sessionId, updatedList, confirmed = false) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    if (!Array.isArray(updatedList)) {
      throw new Error("Ingredients payload must be an array.");
    }

    const deduplicatedMap = new Map();

    for (const rawItem of updatedList) {
      const normalizedName = normalizeIngredientName(rawItem.name || "");
      if (!normalizedName) continue;

      const key = normalizedName.toLowerCase();
      const countVal = Math.max(1, parseInt(rawItem.count, 10) || 1);
      const quantityStr =
        sanitizeText(String(rawItem.quantity || ""), 50) ||
        `${countVal} ${countVal === 1 ? "unit" : "units"}`;

      if (!deduplicatedMap.has(key)) {
        deduplicatedMap.set(key, {
          id:
            sanitizeText(rawItem.id || "", 40) ||
            `ing_${uuidv4().replace(/-/g, "").slice(0, 10)}`,
          name: normalizedName,
          rawClassName: rawItem.rawClassName || key,
          count: countVal,
          quantity: quantityStr,
          maxConfidence:
            typeof rawItem.maxConfidence === "number" ? rawItem.maxConfidence : 1.0,
          avgConfidence:
            typeof rawItem.avgConfidence === "number" ? rawItem.avgConfidence : 1.0,
          confidencePercentage:
            typeof rawItem.confidencePercentage === "number"
              ? rawItem.confidencePercentage
              : 100.0,
          sourceImages: Array.isArray(rawItem.sourceImages)
            ? rawItem.sourceImages
            : [],
          isManual: Boolean(rawItem.isManual),
          isEdited: Boolean(rawItem.isEdited),
        });
      } else {
        // Merge duplicate ingredient names edited/added by user
        const existing = deduplicatedMap.get(key);
        existing.count += countVal;
        if (rawItem.quantity && rawItem.quantity !== existing.quantity) {
          existing.quantity = `${existing.quantity} + ${sanitizeText(
            rawItem.quantity,
            30
          )}`;
        } else {
          existing.quantity = `${existing.count} units`;
        }
        if (Array.isArray(rawItem.sourceImages)) {
          for (const src of rawItem.sourceImages) {
            if (!existing.sourceImages.some((s) => s.imageId === src.imageId)) {
              existing.sourceImages.push(src);
            }
          }
        }
      }
    }

    session.ingredients = Array.from(deduplicatedMap.values());
    session.ingredientsConfirmed = Boolean(confirmed);
    session.updatedAt = Date.now();
    session.expiresAt = Date.now() + this.ttlMs;

    return this.toPublicSession(session);
  }

  /**
   * Resolve the internal disk path of an uploaded image for streaming back to the browser
   * without ever exposing filesystem paths in JSON responses.
   *
   * @param {string} sessionId
   * @param {string} imageId
   * @returns {{ diskPath: string, mimeType: string } | null}
   */
  getImageFileRef(sessionId, imageId) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    const img = session.images.find((item) => item.imageId === imageId);
    if (!img || !img.diskPath || !fs.existsSync(img.diskPath)) {
      return null;
    }
    return {
      diskPath: img.diskPath,
      mimeType: img.mimeType || "image/jpeg",
    };
  }

  /**
   * Save Stage 1 recipe suggestions in the session and clear stale instruction cache if needed.
   *
   * @param {string} sessionId
   * @param {Array<object>} recipes
   */
  setRecipeSuggestions(sessionId, recipes) {
    const session = this.getSession(sessionId);
    if (!session) return;
    session.recipeSuggestions = Array.isArray(recipes) ? recipes : [];
    session.updatedAt = Date.now();
  }

  /**
   * Find a suggested recipe in the current session by `recipeId`.
   *
   * @param {string} sessionId
   * @param {string} recipeId
   * @returns {object|null}
   */
  getRecipeSuggestionById(sessionId, recipeId) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    return (
      session.recipeSuggestions.find((r) => String(r.id) === String(recipeId)) ||
      null
    );
  }

  /**
   * Get cached Stage 2 detailed cooking instructions for a recipe in this session.
   *
   * @param {string} sessionId
   * @param {string} recipeId
   * @returns {object|null}
   */
  getCachedInstructions(sessionId, recipeId) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    return session.instructionsCache.get(String(recipeId)) || null;
  }

  /**
   * Store Stage 2 detailed cooking instructions in the session cache.
   *
   * @param {string} sessionId
   * @param {string} recipeId
   * @param {object} instructions
   */
  setCachedInstructions(sessionId, recipeId, instructions) {
    const session = this.getSession(sessionId);
    if (!session) return;
    session.instructionsCache.set(String(recipeId), instructions);
    session.updatedAt = Date.now();
  }

  /**
   * Delete a session and securely remove all temporary uploaded image files from disk.
   *
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionId) {
    if (!isValidSessionId(sessionId)) return false;
    const session = this.sessions.get(sessionId);
    const targetDir = session
      ? session.sessionDir
      : path.join(this.baseTempDir, sessionId);

    this.sessions.delete(sessionId);

    try {
      await fsp.rm(targetDir, { recursive: true, force: true });
      return true;
    } catch (err) {
      console.error(
        `[SessionService] Failed to delete session directory for ${sessionId}:`,
        err.message
      );
      return false;
    }
  }

  /**
   * Sweep and delete all expired sessions and orphaned directories.
   */
  async cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this._isExpired(session, now)) {
        await this.deleteSession(sessionId);
      }
    }
  }

  _isExpired(session, now = Date.now()) {
    return now > session.expiresAt;
  }

  /**
   * Return a clean, frontend-safe representation of the session (stripping internal disk paths).
   *
   * @param {object} session
   * @returns {object}
   */
  toPublicSession(session) {
    return {
      sessionId: session.sessionId,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      ingredientsConfirmed: session.ingredientsConfirmed,
      images: session.images.map((img) => ({
        imageId: img.imageId,
        originalName: img.originalName,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        uploadMode: img.uploadMode,
        uploadedAt: img.uploadedAt,
        imageUrl: img.imageUrl,
        dimensions: img.dimensions,
        detections: img.detections,
        detectionCount: img.detectionCount,
        inferenceTimeMs: img.inferenceTimeMs,
      })),
      ingredients: session.ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        rawClassName: ing.rawClassName,
        count: ing.count,
        quantity: ing.quantity,
        maxConfidence: ing.maxConfidence,
        avgConfidence: ing.avgConfidence,
        confidencePercentage: ing.confidencePercentage,
        sourceImages: ing.sourceImages,
        isManual: ing.isManual,
        isEdited: ing.isEdited,
      })),
      recipeSuggestions: session.recipeSuggestions,
      cachedRecipeIds: Array.from(session.instructionsCache.keys()),
    };
  }
}

module.exports = new SessionService();
