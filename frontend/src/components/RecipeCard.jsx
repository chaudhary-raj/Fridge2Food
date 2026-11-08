import React from "react";
import {
  Clock,
  Flame,
  ChefHat,
  CheckCircle2,
  PlusCircle,
  Sparkles,
  Loader2,
} from "lucide-react";

export default function RecipeCard({
  recipe,
  onMakeRecipe,
  isLoadingThisCard,
  isCached,
}) {
  const difficultyBadgeColor =
    recipe.difficulty === "Easy"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : recipe.difficulty === "Medium"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 hover:shadow-md transition-all flex flex-col justify-between p-5 sm:p-6">
      <div>
        {/* Top Badges: Cuisine, Difficulty, Match Percentage */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {recipe.cuisine}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${difficultyBadgeColor}`}
            >
              {recipe.difficulty}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
            <Sparkles className="w-3 h-3" />
            <span>{recipe.matchPercentage}% Match</span>
          </div>
        </div>

        {/* Recipe Title & Description */}
        <h3 className="text-lg font-semibold text-slate-900 leading-snug">
          {recipe.name}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 line-clamp-3">
          {recipe.description}
        </p>

        {/* Prep & Cook Time Metadata */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            Prep: <strong className="text-slate-800">{recipe.prepTime}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Cook: <strong className="text-slate-800">{recipe.cookTime}</strong>
          </span>
        </div>

        {/* Dietary Tags */}
        {Array.isArray(recipe.dietaryTags) && recipe.dietaryTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.dietaryTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-100"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Matched Confirmed Ingredients */}
        {Array.isArray(recipe.matchedIngredients) &&
          recipe.matchedIngredients.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Uses Your Ingredients ({recipe.matchedIngredients.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {recipe.matchedIngredients.map((ing) => (
                  <span
                    key={ing}
                    className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

        {/* Additional Ingredients Required */}
        {Array.isArray(recipe.additionalIngredients) &&
          recipe.additionalIngredients.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                Additional Pantry Items ({recipe.additionalIngredients.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {recipe.additionalIngredients.map((ing) => (
                  <span
                    key={ing}
                    className="px-2 py-0.5 rounded-md text-xs text-slate-600 bg-slate-100"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Stage 2 Trigger: Make This Recipe Button */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onMakeRecipe(recipe)}
          disabled={isLoadingThisCard}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-bold text-white bg-slate-900 hover:bg-emerald-600 transition-colors disabled:opacity-60"
        >
          {isLoadingThisCard ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Preparing Cooking Steps...</span>
            </>
          ) : (
            <>
              <ChefHat className="w-4 h-4" />
              <span>
                {isCached ? "Open Cooking Guide (Cached)" : "Make This Recipe"}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
