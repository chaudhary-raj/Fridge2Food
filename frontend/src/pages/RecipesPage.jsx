import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Filter,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Utensils,
} from "lucide-react";
import { useSession } from "../context/SessionContext";
import RecipeCard from "../components/RecipeCard";

export default function RecipesPage() {
  const navigate = useNavigate();
  const {
    ingredients,
    recipeSuggestions,
    instructionsByRecipeId,
    isGeneratingRecipes,
    isGeneratingInstructions,
    errorMessage,
    setErrorMessage,
    confirmIngredientsAndSuggestRecipes,
    fetchOrGenerateInstructions,
  } = useSession();

  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [maxPrepFilter, setMaxPrepFilter] = useState("All");
  const [loadingRecipeId, setLoadingRecipeId] = useState(null);

  // Extract unique cuisines dynamically from Stage 1 recipe suggestions
  const availableCuisines = useMemo(() => {
    const set = new Set(["All"]);
    recipeSuggestions.forEach((r) => {
      if (r.cuisine) set.add(r.cuisine);
    });
    return Array.from(set);
  }, [recipeSuggestions]);

  // Filter recipes by cuisine, difficulty, and preparation time
  const filteredRecipes = useMemo(() => {
    return recipeSuggestions.filter((recipe) => {
      if (selectedCuisine !== "All" && recipe.cuisine !== selectedCuisine) {
        return false;
      }
      if (
        selectedDifficulty !== "All" &&
        recipe.difficulty !== selectedDifficulty
      ) {
        return false;
      }
      if (maxPrepFilter !== "All") {
        const maxMins = parseInt(maxPrepFilter, 10);
        if (
          Number.isFinite(maxMins) &&
          (recipe.prepTimeMinutes || 20) > maxMins
        ) {
          return false;
        }
      }
      return true;
    });
  }, [recipeSuggestions, selectedCuisine, selectedDifficulty, maxPrepFilter]);

  const handleMakeThisRecipe = async (recipe) => {
    setLoadingRecipeId(recipe.id);
    try {
      await fetchOrGenerateInstructions(recipe);
      navigate(`/cook/${recipe.id}`);
    } catch {
      // Error handled by context
    } finally {
      setLoadingRecipeId(null);
    }
  };

  if (recipeSuggestions.length === 0 && !isGeneratingRecipes) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-white rounded-lg border border-slate-200 p-8 sm:p-12">
          <div className="w-14 h-14 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
            <Utensils className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            No recipes yet
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            Confirm your ingredient list to see what you can cook.
          </p>
          <div className="mt-6">
            <Link
              to="/detect"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Add ingredients</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Confirmed Ingredients Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-1">
            Recommended Recipes ({filteredRecipes.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Based on your {ingredients.length} confirmed{" "}
            {ingredients.length === 1 ? "ingredient" : "ingredients"}:{" "}
            <span className="font-semibold text-slate-800">
              {ingredients.map((i) => i.name).join(", ")}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <Link
            to="/detect"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Edit Ingredients</span>
          </Link>

          <button
            type="button"
            disabled={isGeneratingRecipes}
            onClick={() => confirmIngredientsAndSuggestRecipes()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isGeneratingRecipes ? "animate-spin" : ""}`}
            />
            <span>Regenerate Suggestions</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-sm text-rose-800">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold text-rose-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar: Cuisine, Difficulty, Max Prep Time */}
      <div className="bg-white rounded-lg border border-slate-200/90 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filter Suggestions:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Cuisine Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium">Cuisine:</label>
            <select
              value={selectedCuisine}
              onChange={(e) => setSelectedCuisine(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500"
            >
              {availableCuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium">
              Difficulty:
            </label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">All Levels</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {/* Prep Time Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 font-medium">
              Prep Time:
            </label>
            <select
              value={maxPrepFilter}
              onChange={(e) => setMaxPrepFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">Any Time</option>
              <option value="15">Under 15 mins</option>
              <option value="30">Under 30 mins</option>
              <option value="45">Under 45 mins</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recipe Cards Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No recipes match your current filter selection.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCuisine("All");
              setSelectedDifficulty("All");
              setMaxPrepFilter("All");
            }}
            className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onMakeRecipe={handleMakeThisRecipe}
              isLoadingThisCard={
                isGeneratingInstructions && loadingRecipeId === recipe.id
              }
              isCached={Boolean(instructionsByRecipeId[recipe.id])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
