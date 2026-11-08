/**
 * Fridge2Food — Global Session & Workflow Context
 *
 * Manages:
 * - Active `sessionId` persisted in `sessionStorage` for tab continuity
 * - Uploaded & processed images with YOLO11s bounding boxes
 * - Editable ingredient list & confirmation state (source of truth for Gemini)
 * - Stage 1 recipe suggestions
 * - Stage 2 detailed cooking instructions cache (avoids duplicate Gemini calls)
 * - System health status (Express + FastAPI + YOLO11s model readiness)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  fetchSystemHealth,
  fetchSessionState,
  uploadAndDetectImages,
  saveSessionIngredients,
  removeSessionImage,
  requestRecipeSuggestions,
  requestRecipeInstructions,
  deleteSessionOnServer,
  extractErrorMessage,
} from "../services/api";

const SessionContext = createContext(null);

const SESSION_STORAGE_KEY = "smartplate_active_session_id";

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(
    () => sessionStorage.getItem(SESSION_STORAGE_KEY) || ""
  );
  const [processedImages, setProcessedImages] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientsConfirmed, setIngredientsConfirmed] = useState(false);
  const [recipeSuggestions, setRecipeSuggestions] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [instructionsByRecipeId, setInstructionsByRecipeId] = useState({});
  const [inferenceMeta, setInferenceMeta] = useState(null);

  // Loading & progress states
  const [isDetecting, setIsDetecting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);
  const [isGeneratingInstructions, setIsGeneratingInstructions] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  // Persist sessionId in browser sessionStorage
  const updateSessionId = useCallback((newId) => {
    setSessionId(newId || "");
    if (newId) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // Sync state from backend public session object
  const applyServerSession = useCallback(
    (sessionObj) => {
      if (!sessionObj) return;
      if (sessionObj.sessionId) {
        updateSessionId(sessionObj.sessionId);
      }
      if (Array.isArray(sessionObj.images)) {
        setProcessedImages(sessionObj.images);
      }
      if (Array.isArray(sessionObj.ingredients)) {
        setIngredients(sessionObj.ingredients);
      }
      if (typeof sessionObj.ingredientsConfirmed === "boolean") {
        setIngredientsConfirmed(sessionObj.ingredientsConfirmed);
      }
      if (
        Array.isArray(sessionObj.recipeSuggestions) &&
        sessionObj.recipeSuggestions.length > 0
      ) {
        setRecipeSuggestions(sessionObj.recipeSuggestions);
      }
    },
    [updateSessionId]
  );

  // Check backend & FastAPI health on mount
  const refreshHealth = useCallback(async () => {
    try {
      const data = await fetchSystemHealth();
      setSystemHealth(data);
      return data;
    } catch {
      setSystemHealth({
        status: "offline",
        geminiConfigured: false,
        inferenceService: { available: false, model_loaded: false },
      });
      return null;
    }
  }, []);

  // Restore existing session on page reload if still active on server
  useEffect(() => {
    refreshHealth();
    const existingId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existingId) {
      fetchSessionState(existingId)
        .then((data) => {
          if (data?.success) {
            setProcessedImages(data.images || []);
            setIngredients(data.ingredients || []);
            setIngredientsConfirmed(Boolean(data.ingredientsConfirmed));
            if (Array.isArray(data.recipeSuggestions)) {
              setRecipeSuggestions(data.recipeSuggestions);
            }
          }
        })
        .catch(() => {
          // Session expired on backend; reset local storage ID
          updateSessionId("");
        });
    }
  }, [refreshHealth, updateSessionId]);

  /**
   * Run YOLO11s object detection on uploaded files (supports both multiple individual images
   * and single fridge photos in the same session).
   */
  const runDetection = async (files, uploadMode = "multi", confidence = 0.4) => {
    setErrorMessage(null);
    setIsDetecting(true);
    setUploadProgress(0);
    try {
      const data = await uploadAndDetectImages(files, {
        sessionId: sessionId || undefined,
        uploadMode,
        confidence,
        onProgress: (pct) => setUploadProgress(pct),
      });

      if (data?.session) {
        applyServerSession(data.session);
      }
      if (data?.inferenceMeta) {
        setInferenceMeta(data.inferenceMeta);
      }
      return data;
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Object detection failed. Please check that the Python FastAPI service and YOLO11s model are running."
      );
      setErrorMessage(msg);
      throw new Error(msg);
    } finally {
      setIsDetecting(false);
      setUploadProgress(0);
    }
  };

  /**
   * Remove one processed image from the current session.
   */
  const deleteProcessedImage = async (imageId) => {
    if (!sessionId) return;
    setErrorMessage(null);
    try {
      const data = await removeSessionImage(sessionId, imageId);
      if (data?.session) {
        applyServerSession(data.session);
      }
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, "Failed to remove image."));
    }
  };

  /**
   * Add a new ingredient manually to the editable list.
   */
  const addManualIngredient = (name, quantity = "1 unit", count = 1) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;

    const normalized = trimmed
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    setIngredients((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.name.toLowerCase() === normalized.toLowerCase()
      );
      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newCount = (existing.count || 1) + (parseInt(count, 10) || 1);
        updated[existingIndex] = {
          ...existing,
          count: newCount,
          quantity: quantity !== "1 unit" ? quantity : `${newCount} units`,
          isEdited: true,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: normalized,
          rawClassName: normalized.toLowerCase(),
          count: Math.max(1, parseInt(count, 10) || 1),
          quantity: String(quantity || "1 unit").trim() || "1 unit",
          maxConfidence: 1.0,
          avgConfidence: 1.0,
          confidencePercentage: 100.0,
          sourceImages: [],
          isManual: true,
          isEdited: true,
        },
      ];
    });
    setIngredientsConfirmed(false);
  };

  /**
   * Edit an existing ingredient's name, count, or quantity.
   */
  const updateIngredientItem = (id, changes) => {
    setIngredients((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...changes,
              isEdited: true,
            }
          : item
      );

      // Merge if user renamed an ingredient to match another existing ingredient
      const mapByName = new Map();
      for (const ing of updated) {
        const key = String(ing.name || "").trim().toLowerCase();
        if (!key) continue;
        if (!mapByName.has(key)) {
          mapByName.set(key, { ...ing });
        } else {
          const existing = mapByName.get(key);
          existing.count = (existing.count || 1) + (ing.count || 1);
          existing.quantity = `${existing.count} units`;
          existing.isEdited = true;
        }
      }
      return Array.from(mapByName.values());
    });
    setIngredientsConfirmed(false);
  };

  /**
   * Remove an ingredient from the editable list.
   */
  const removeIngredientItem = (id) => {
    setIngredients((prev) => prev.filter((item) => item.id !== id));
    setIngredientsConfirmed(false);
  };

  /**
   * Confirm the final edited ingredient list and trigger Stage 1 Gemini recipe suggestions.
   */
  const confirmIngredientsAndSuggestRecipes = async (preferences = {}) => {
    if (ingredients.length === 0) {
      const msg = "Please add or detect at least one ingredient before confirming.";
      setErrorMessage(msg);
      throw new Error(msg);
    }

    setErrorMessage(null);
    setIsGeneratingRecipes(true);
    try {
      // 1. Persist confirmed ingredients on the backend session
      const saveRes = await saveSessionIngredients(sessionId, ingredients, true);
      const activeId = saveRes.sessionId || sessionId;
      if (saveRes.session) {
        applyServerSession(saveRes.session);
      } else {
        updateSessionId(activeId);
        setIngredientsConfirmed(true);
      }

      // 2. Call Stage 1 Gemini endpoint (/api/recipes/suggest)
      const suggestRes = await requestRecipeSuggestions({
        sessionId: activeId,
        ingredients: saveRes.ingredients || ingredients,
        confirmed: true,
        preferences,
      });

      setRecipeSuggestions(suggestRes.recipes || []);
      return suggestRes.recipes || [];
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Failed to generate recipe suggestions. Verify your GEMINI_API_KEY in backend/.env."
      );
      setErrorMessage(msg);
      throw new Error(msg);
    } finally {
      setIsGeneratingRecipes(false);
    }
  };

  /**
   * Trigger Stage 2 Gemini API call ONLY when the user clicks "Make This Recipe".
   * Uses client + server session caching so repeated clicks are instant.
   */
  const fetchOrGenerateInstructions = async (recipe) => {
    if (!recipe || !recipe.id) return null;
    setSelectedRecipe(recipe);
    setErrorMessage(null);

    // Check frontend session cache first
    if (instructionsByRecipeId[recipe.id]) {
      return instructionsByRecipeId[recipe.id];
    }

    setIsGeneratingInstructions(true);
    try {
      const res = await requestRecipeInstructions({
        recipeId: recipe.id,
        sessionId,
        recipe,
        ingredients,
      });

      if (res?.instructions) {
        setInstructionsByRecipeId((prev) => ({
          ...prev,
          [recipe.id]: res.instructions,
        }));
      }
      return res.instructions;
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Failed to generate detailed cooking instructions."
      );
      setErrorMessage(msg);
      throw new Error(msg);
    } finally {
      setIsGeneratingInstructions(false);
    }
  };

  /**
   * Clear the current session and delete all temporary files on the server.
   */
  const clearSession = async () => {
    setErrorMessage(null);
    const idToClear = sessionId;

    // Reset local state immediately
    updateSessionId("");
    setProcessedImages([]);
    setIngredients([]);
    setIngredientsConfirmed(false);
    setRecipeSuggestions([]);
    setSelectedRecipe(null);
    setInstructionsByRecipeId({});
    setInferenceMeta(null);

    if (idToClear) {
      try {
        await deleteSessionOnServer(idToClear);
      } catch {
        // Ignore if already expired
      }
    }
  };

  const value = {
    sessionId,
    processedImages,
    ingredients,
    ingredientsConfirmed,
    recipeSuggestions,
    selectedRecipe,
    setSelectedRecipe,
    instructionsByRecipeId,
    inferenceMeta,
    isDetecting,
    uploadProgress,
    isGeneratingRecipes,
    isGeneratingInstructions,
    errorMessage,
    setErrorMessage,
    systemHealth,
    refreshHealth,
    runDetection,
    deleteProcessedImage,
    addManualIngredient,
    updateIngredientItem,
    removeIngredientItem,
    confirmIngredientsAndSuggestRecipes,
    fetchOrGenerateInstructions,
    clearSession,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside a SessionProvider");
  }
  return ctx;
}
