/**
 * Fridge2Food — Two-Stage Gemini API Service (Backend Only)
 *
 * Security & Architecture:
 * - Keeps `GEMINI_API_KEY` exclusively on the Node.js backend; never exposed to React.
 * - Uses the official `@google/genai` SDK (`GoogleGenAI`) with a seamless fallback to
 *   the Gemini REST API if needed, requesting `application/json` structured output.
 * - Validates and sanitizes all JSON fields returned by Gemini so malformed or incomplete
 *   responses are handled safely.
 *
 * Stage 1 (`generateRecipeSuggestions`):
 *   - Accepts only the user-confirmed ingredient list (and optional dietary/cuisine preferences).
 *   - Generates 5–8 suitable recipes.
 *   - Strictly excludes cooking steps or full instructions at Stage 1.
 *
 * Stage 2 (`generateRecipeInstructions`):
 *   - Triggered ONLY when a user clicks "Make This Recipe" on a specific recipe card.
 *   - Generates complete cooking instructions: exact quantities, available vs. additional
 *     ingredients, preparation instructions, numbered steps with cooking time and heat/temp,
 *     cooking tips, substitutions, and serving suggestions.
 */

const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const { sanitizeText } = require("../utils/validators");

let GoogleGenAIClient = null;
try {
  const genaiModule = require("@google/genai");
  GoogleGenAIClient = genaiModule.GoogleGenAI;
} catch {
  GoogleGenAIClient = null;
}

class GeminiService {
  constructor() {
    this.sdkInstance = null;
  }

  /**
   * Check whether a real Gemini API key is configured.
   *
   * @returns {boolean}
   */
  isConfigured() {
    const key = config.geminiApiKey;
    return Boolean(
      key &&
        key.length > 10 &&
        key !== "your_gemini_api_key_here" &&
        !key.startsWith("REPLACE_")
    );
  }

  /**
   * Lazily initialize the `@google/genai` SDK client.
   */
  _getClient() {
    if (!this.isConfigured()) {
      const err = new Error(
        "GEMINI_API_KEY is not configured. Please add your Gemini API key to `backend/.env` and restart the backend server."
      );
      err.statusCode = 503;
      throw err;
    }

    if (!this.sdkInstance && GoogleGenAIClient) {
      this.sdkInstance = new GoogleGenAIClient({ apiKey: config.geminiApiKey });
    }
    return this.sdkInstance;
  }

  /**
   * Invoke Gemini with structured JSON output via `@google/genai` SDK or direct REST endpoint.
   *
   * @param {string} prompt
   * @param {object} [responseSchema]
   * @returns {Promise<any>}
   */
  async _callGeminiJson(prompt, responseSchema = null) {
    if (!this.isConfigured()) {
      const err = new Error(
        "GEMINI_API_KEY is missing or set to the placeholder value in backend/.env. Configure a valid Gemini API key to generate recipes."
      );
      err.statusCode = 503;
      throw err;
    }

    const modelName = config.geminiModel || "gemini-2.5-flash";
    let rawText = "";

    try {
      const sdk = this._getClient();
      if (sdk && sdk.models && typeof sdk.models.generateContent === "function") {
        const generationConfig = {
          temperature: 0.4,
          responseMimeType: "application/json",
        };
        if (responseSchema) {
          generationConfig.responseSchema = responseSchema;
        }

        const result = await sdk.models.generateContent({
          model: modelName,
          contents: prompt,
          config: generationConfig,
        });

        rawText =
          typeof result.text === "function" ? result.text() : result.text || "";
      } else {
        // Fallback to direct Gemini REST API call
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelName
        )}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        };

        const response = await axios.post(url, payload, { timeout: 45000 });
        rawText =
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } catch (apiError) {
      const message =
        apiError.response?.data?.error?.message ||
        apiError.message ||
        "Failed to communicate with Gemini API.";
      const wrapped = new Error(`Gemini API request failed: ${message}`);
      wrapped.statusCode = apiError.statusCode || 502;
      throw wrapped;
    }

    return this._parseAndValidateJson(rawText);
  }

  /**
   * Safely parse JSON from Gemini response, stripping accidental markdown fences if present.
   *
   * @param {string} rawText
   * @returns {any}
   */
  _parseAndValidateJson(rawText) {
    if (!rawText || typeof rawText !== "string") {
      const err = new Error("Gemini returned an empty response.");
      err.statusCode = 502;
      throw err;
    }

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch {
      // Attempt to extract first JSON object or array substring
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } catch {
          // Fall through
        }
      }
      const err = new Error(
        "Received malformed JSON from Gemini API. Please try generating again."
      );
      err.statusCode = 502;
      throw err;
    }
  }

  /**
   * STAGE 1: Generate 5–8 personalized recipe suggestions from the user-confirmed ingredient list.
   * Explicitly omits cooking steps and full cooking instructions at this stage.
   *
   * @param {Array<object>} confirmedIngredients
   * @param {object} [preferences]
   * @returns {Promise<Array<object>>}
   */
  async generateRecipeSuggestions(confirmedIngredients, preferences = {}) {
    if (!Array.isArray(confirmedIngredients) || confirmedIngredients.length === 0) {
      const err = new Error(
        "At least one confirmed ingredient is required before generating recipe suggestions."
      );
      err.statusCode = 400;
      throw err;
    }

    const formattedIngredients = confirmedIngredients
      .map((item) => {
        const name = sanitizeText(item.name || "", 60);
        const qty = sanitizeText(item.quantity || `${item.count || 1} unit`, 40);
        return `- ${name} (${qty})`;
      })
      .join("\n");

    const cuisinePref = sanitizeText(preferences.cuisine || "", 50);
    const dietaryPref = sanitizeText(preferences.dietary || "", 60);
    const maxTimePref = parseInt(preferences.maxPrepTime, 10) || null;

    const prompt = `You are Fridge2Food, an expert culinary chef and nutritionist.
The user has confirmed the following available food ingredients from their kitchen/fridge:
${formattedIngredients}

${cuisinePref ? `Preferred cuisine filter: ${cuisinePref}` : ""}
${dietaryPref ? `Dietary preference: ${dietaryPref}` : ""}
${maxTimePref ? `Preferred maximum preparation time: ${maxTimePref} minutes` : ""}

TASK (STAGE 1 — RECIPE SUGGESTIONS ONLY):
Generate between 6 and 8 diverse, delicious, and practical recipe suggestions that maximize the use of the confirmed ingredients above.

CRITICAL RULES:
1. Return between 5 and 8 recipes inside a JSON object with key "recipes".
2. DO NOT include cooking steps, preparation instructions, or step-by-step directions at this stage.
3. For each recipe, provide:
   - "name": Recipe name (string)
   - "description": Engaging 1–2 sentence summary of the dish (string)
   - "prepTimeMinutes": Estimated preparation time in minutes (integer, e.g., 15)
   - "cookTimeMinutes": Estimated cooking time in minutes (integer, e.g., 20)
   - "prepTime": Formatted preparation time string (e.g., "15 mins")
   - "cookTime": Formatted cooking time string (e.g., "20 mins")
   - "difficulty": One of "Easy", "Medium", or "Hard"
   - "cuisine": Cuisine type (e.g., "Mediterranean", "Indian", "Italian", "Asian", "Mexican", "American")
   - "matchPercentage": Integer between 50 and 100 representing ingredient compatibility with the user's confirmed ingredients
   - "matchedIngredients": Array of strings listing which of the user's confirmed ingredients are used
   - "additionalIngredients": Array of strings listing extra ingredients required beyond what the user already has (pantry staples or 1-3 items)
   - "dietaryTags": Array of applicable dietary tags (e.g., ["Vegetarian", "Gluten-Free", "High-Protein", "Vegan", "Low-Carb"])

Respond strictly with valid JSON matching this structure:
{
  "recipes": [
    {
      "name": "...",
      "description": "...",
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 20,
      "prepTime": "15 mins",
      "cookTime": "20 mins",
      "difficulty": "Easy",
      "cuisine": "Italian",
      "matchPercentage": 92,
      "matchedIngredients": ["Tomato", "Onion"],
      "additionalIngredients": ["Olive Oil", "Garlic", "Salt"],
      "dietaryTags": ["Vegetarian", "Gluten-Free"]
    }
  ]
}`;

    const parsed = await this._callGeminiJson(prompt);
    const rawList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.recipes)
      ? parsed.recipes
      : [];

    if (rawList.length === 0) {
      const err = new Error(
        "Gemini did not return any valid recipe suggestions. Please try again."
      );
      err.statusCode = 502;
      throw err;
    }

    // Normalize and enforce Stage 1 schema (guaranteed no cooking steps)
    return rawList.slice(0, 8).map((item, idx) => {
      const prepMins = Math.max(1, parseInt(item.prepTimeMinutes, 10) || 15);
      const cookMins = Math.max(0, parseInt(item.cookTimeMinutes, 10) || 20);
      const matchPct = Math.min(
        100,
        Math.max(10, parseInt(item.matchPercentage, 10) || 85)
      );
      const difficultyAllowed = ["Easy", "Medium", "Hard"];
      const diffNormalized = difficultyAllowed.includes(item.difficulty)
        ? item.difficulty
        : "Easy";

      return {
        id: `rec_${idx + 1}_${uuidv4().replace(/-/g, "").slice(0, 8)}`,
        name: sanitizeText(item.name || `Chef's Special Recipe ${idx + 1}`, 100),
        description: sanitizeText(
          item.description ||
            "A flavorful dish crafted around your fresh kitchen ingredients.",
          300
        ),
        prepTimeMinutes: prepMins,
        cookTimeMinutes: cookMins,
        totalTimeMinutes: prepMins + cookMins,
        prepTime: sanitizeText(item.prepTime || `${prepMins} mins`, 30),
        cookTime: sanitizeText(item.cookTime || `${cookMins} mins`, 30),
        difficulty: diffNormalized,
        cuisine: sanitizeText(item.cuisine || "International", 50),
        matchPercentage: matchPct,
        matchedIngredients: Array.isArray(item.matchedIngredients)
          ? item.matchedIngredients
              .map((ing) => sanitizeText(String(ing), 60))
              .filter(Boolean)
          : confirmedIngredients.map((c) => c.name),
        additionalIngredients: Array.isArray(item.additionalIngredients)
          ? item.additionalIngredients
              .map((ing) => sanitizeText(String(ing), 60))
              .filter(Boolean)
          : [],
        dietaryTags: Array.isArray(item.dietaryTags)
          ? item.dietaryTags
              .map((tag) => sanitizeText(String(tag), 40))
              .filter(Boolean)
          : [],
      };
    });
  }

  /**
   * STAGE 2: Generate complete, step-by-step cooking instructions ONLY when the user clicks
   * "Make This Recipe" on a specific card.
   *
   * @param {object} recipeSummary - Selected Stage 1 recipe card object
   * @param {Array<object>} confirmedIngredients - Confirmed user ingredients
   * @returns {Promise<object>}
   */
  async generateRecipeInstructions(recipeSummary, confirmedIngredients) {
    if (!recipeSummary || !recipeSummary.name) {
      const err = new Error("Valid recipe details are required to generate instructions.");
      err.statusCode = 400;
      throw err;
    }

    const availableList = (confirmedIngredients || [])
      .map((i) => `${i.name} (${i.quantity || `${i.count || 1} unit`})`)
      .join(", ");

    const prompt = `You are Fridge2Food, a master culinary instructor.
The user selected the following recipe to cook right now:
- Recipe Name: ${recipeSummary.name}
- Description: ${recipeSummary.description}
- Cuisine: ${recipeSummary.cuisine}
- Difficulty: ${recipeSummary.difficulty}
- Estimated Prep Time: ${recipeSummary.prepTime}
- Estimated Cook Time: ${recipeSummary.cookTime}
- User's Confirmed Available Ingredients: ${availableList}
- Additional Ingredients Mentioned in Overview: ${(recipeSummary.additionalIngredients || []).join(", ") || "Basic pantry staples"}

TASK (STAGE 2 — DETAILED COOKING INSTRUCTIONS):
Generate a complete, foolproof, restaurant-quality cooking guide for "${recipeSummary.name}".

Include all of the following fields in valid JSON:
1. "recipeName": String
2. "servings": Integer (e.g., 2 or 4)
3. "prepTime": String (e.g., "15 mins")
4. "cookTime": String (e.g., "20 mins")
5. "totalTime": String (e.g., "35 mins")
6. "difficulty": String ("Easy", "Medium", or "Hard")
7. "cuisine": String
8. "ingredientsAvailable": Array of objects with exact measurements for ingredients the user already has:
   [{ "name": "Roma Tomatoes", "quantity": "3 medium (approx. 350g)", "notes": "diced" }]
9. "ingredientsAdditional": Array of objects with exact measurements for additional required ingredients:
   [{ "name": "Extra-Virgin Olive Oil", "quantity": "2 tbsp", "notes": "for sautéing" }]
10. "preparationInstructions": Array of strings describing mise-en-place / prep tasks before turning on the stove (washing, chopping, preheating, marinating).
11. "steps": Array of numbered step objects (minimum 5 detailed steps):
   [
     {
       "stepNumber": 1,
       "title": "Aromatics & Base Sauté",
       "instruction": "Detailed step-by-step action...",
       "durationMinutes": 5,
       "durationText": "5 mins",
       "heatLevel": "Medium heat (175°C / 350°F)",
       "tip": "Optional pro tip specific to this step"
     }
   ]
12. "cookingTips": Array of 3–5 chef tips for texture, flavor balance, and doneness.
13. "substitutions": Array of objects with ingredient swap options:
   [{ "ingredient": "Heavy Cream", "substitute": "Coconut cream or Greek yogurt", "notes": "Adds richness while keeping it lighter" }]
14. "servingSuggestions": Array of 2–4 plating, garnish, and side-dish pairing ideas.

Respond strictly with valid JSON.`;

    const parsed = await this._callGeminiJson(prompt);

    const stepsRaw = Array.isArray(parsed?.steps) ? parsed.steps : [];
    if (stepsRaw.length === 0) {
      const err = new Error(
        "Gemini returned incomplete cooking steps. Please retry."
      );
      err.statusCode = 502;
      throw err;
    }

    return {
      recipeId: recipeSummary.id,
      recipeName: sanitizeText(parsed.recipeName || recipeSummary.name, 120),
      description: recipeSummary.description,
      servings: Math.max(1, parseInt(parsed.servings, 10) || 2),
      prepTime: sanitizeText(parsed.prepTime || recipeSummary.prepTime, 40),
      cookTime: sanitizeText(parsed.cookTime || recipeSummary.cookTime, 40),
      totalTime: sanitizeText(
        parsed.totalTime ||
          `${(recipeSummary.prepTimeMinutes || 15) + (recipeSummary.cookTimeMinutes || 20)} mins`,
        40
      ),
      difficulty: sanitizeText(parsed.difficulty || recipeSummary.difficulty, 20),
      cuisine: sanitizeText(parsed.cuisine || recipeSummary.cuisine, 50),
      dietaryTags: recipeSummary.dietaryTags || [],
      ingredientsAvailable: Array.isArray(parsed.ingredientsAvailable)
        ? parsed.ingredientsAvailable.map((item) => ({
            name: sanitizeText(item.name || "Ingredient", 80),
            quantity: sanitizeText(item.quantity || "As needed", 60),
            notes: sanitizeText(item.notes || "", 120),
          }))
        : (confirmedIngredients || []).map((item) => ({
            name: item.name,
            quantity: item.quantity || `${item.count || 1} unit`,
            notes: "",
          })),
      ingredientsAdditional: Array.isArray(parsed.ingredientsAdditional)
        ? parsed.ingredientsAdditional.map((item) => ({
            name: sanitizeText(item.name || "Pantry item", 80),
            quantity: sanitizeText(item.quantity || "To taste", 60),
            notes: sanitizeText(item.notes || "", 120),
          }))
        : (recipeSummary.additionalIngredients || []).map((name) => ({
            name,
            quantity: "To taste",
            notes: "",
          })),
      preparationInstructions: Array.isArray(parsed.preparationInstructions)
        ? parsed.preparationInstructions
            .map((p) => sanitizeText(String(p), 300))
            .filter(Boolean)
        : [],
      steps: stepsRaw.map((step, index) => ({
        stepNumber: index + 1,
        title: sanitizeText(step.title || `Step ${index + 1}`, 100),
        instruction: sanitizeText(step.instruction || String(step), 800),
        durationMinutes: Math.max(0, parseInt(step.durationMinutes, 10) || 0),
        durationText: sanitizeText(
          step.durationText ||
            (step.durationMinutes ? `${step.durationMinutes} mins` : "2-3 mins"),
          40
        ),
        heatLevel: sanitizeText(step.heatLevel || "Medium heat", 80),
        tip: sanitizeText(step.tip || "", 250),
      })),
      cookingTips: Array.isArray(parsed.cookingTips)
        ? parsed.cookingTips
            .map((tip) => sanitizeText(String(tip), 300))
            .filter(Boolean)
        : [],
      substitutions: Array.isArray(parsed.substitutions)
        ? parsed.substitutions.map((sub) => ({
            ingredient: sanitizeText(sub.ingredient || "", 80),
            substitute: sanitizeText(sub.substitute || "", 120),
            notes: sanitizeText(sub.notes || "", 200),
          }))
        : [],
      servingSuggestions: Array.isArray(parsed.servingSuggestions)
        ? parsed.servingSuggestions
            .map((s) => sanitizeText(String(s), 250))
            .filter(Boolean)
        : [],
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = new GeminiService();
