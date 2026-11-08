import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChefHat,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Lightbulb,
  Repeat,
  Utensils,
  Loader2,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";
import { useSession } from "../context/SessionContext";

export default function CookingPage() {
  const { recipeId } = useParams();
  const {
    recipeSuggestions,
    selectedRecipe,
    instructionsByRecipeId,
    isGeneratingInstructions,
    fetchOrGenerateInstructions,
    errorMessage,
  } = useSession();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState({});
  const [checkedIngredients, setCheckedIngredients] = useState({});

  const instructions = instructionsByRecipeId[recipeId] || null;

  // Trigger Stage 2 load if user navigated directly or refreshed
  useEffect(() => {
    if (!instructions && !isGeneratingInstructions) {
      const target =
        selectedRecipe?.id === recipeId
          ? selectedRecipe
          : recipeSuggestions.find((r) => String(r.id) === String(recipeId));
      if (target) {
        fetchOrGenerateInstructions(target).catch(() => {});
      }
    }
  }, [
    recipeId,
    instructions,
    isGeneratingInstructions,
    selectedRecipe,
    recipeSuggestions,
    fetchOrGenerateInstructions,
  ]);

  const toggleIngredientCheck = (key) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleStepCompleted = (stepNum) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }));
  };

  if (isGeneratingInstructions && !instructions) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="bg-white rounded-lg border border-slate-200 p-10 space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
          <h2 className="text-xl font-semibold text-slate-900">
            Crafting Your Step-by-Step Cooking Guide...
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Getting the quantities and cooking steps for your dish.
          </p>
        </div>
      </div>
    );
  }

  if (!instructions) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-white rounded-lg border border-slate-200 p-10 space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">
            Cooking Instructions Unavailable
          </h2>
          <p className="text-sm text-slate-600">
            {errorMessage ||
              "Please select a recipe from your recommendations page first."}
          </p>
          <Link
            to="/recipes"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Recipe Suggestions</span>
          </Link>
        </div>
      </div>
    );
  }

  const steps = Array.isArray(instructions.steps) ? instructions.steps : [];
  const totalSteps = steps.length || 1;
  const safeIndex = Math.min(currentStepIndex, totalSteps - 1);
  const activeStep = steps[safeIndex] || {};

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round(
    (Math.max(completedCount, safeIndex + 1) / totalSteps) * 100
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Navigation & Recipe Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/recipes"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Recipe Suggestions</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
            {instructions.recipeName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {instructions.description}
          </p>
        </div>

        {/* Summary Pills */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700">
            Servings: <strong>{instructions.servings}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700">
            Prep: <strong>{instructions.prepTime}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700">
            Cook: <strong>{instructions.cookTime}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-600 text-white">
            {instructions.difficulty}
          </span>
        </div>
      </div>

      {/* Overall Cooking Progress Bar */}
      <div className="bg-white rounded-lg border border-slate-200/90 p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span>
            Step {safeIndex + 1} of {totalSteps} &bull; {completedCount} Completed
          </span>
          <span className="text-emerald-700">{progressPercent}% Progress</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Two-Column Cooking Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Ingredient Quantities & Interactive Checklist */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200/90 p-5 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>Ingredient Checklist</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Check off items as you measure and prep them.
              </p>
            </div>

            {/* Available Ingredients */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">
                Ingredients You Have ({instructions.ingredientsAvailable?.length || 0})
              </h3>
              <div className="space-y-2">
                {(instructions.ingredientsAvailable || []).map((item, idx) => {
                  const key = `avail_${idx}`;
                  const checked = Boolean(checkedIngredients[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleIngredientCheck(key)}
                      className={`w-full text-left p-2.5 rounded-md border text-xs transition-all flex items-start gap-2.5 ${
                        checked
                          ? "bg-emerald-50/60 border-emerald-200 text-slate-400 line-through"
                          : "bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-white"
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <span className="font-bold">{item.name}</span>{" "}
                        <span className="text-emerald-700 font-semibold">
                          — {item.quantity}
                        </span>
                        {item.notes && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional Required Ingredients */}
            {Array.isArray(instructions.ingredientsAdditional) &&
              instructions.ingredientsAdditional.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                    Additional Ingredients Required (
                    {instructions.ingredientsAdditional.length})
                  </h3>
                  <div className="space-y-2">
                    {instructions.ingredientsAdditional.map((item, idx) => {
                      const key = `add_${idx}`;
                      const checked = Boolean(checkedIngredients[key]);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleIngredientCheck(key)}
                          className={`w-full text-left p-2.5 rounded-md border text-xs transition-all flex items-start gap-2.5 ${
                            checked
                              ? "bg-emerald-50/60 border-emerald-200 text-slate-400 line-through"
                              : "bg-amber-50/40 border-amber-200/80 text-slate-800 hover:bg-white"
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <span className="font-bold">{item.name}</span>{" "}
                            <span className="text-amber-800 font-semibold">
                              — {item.quantity}
                            </span>
                            {item.notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Preparation (Mise en Place) */}
            {Array.isArray(instructions.preparationInstructions) &&
              instructions.preparationInstructions.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Preparation (Mise en Place)
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                    {instructions.preparationInstructions.map((prep, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {prep}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>

        {/* Right Main Column: Interactive Step-by-Step Navigator + All Steps + Tips */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Step Spotlight Card */}
          <div className="bg-white rounded-lg border-2 border-emerald-500/80 shadow-md p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white">
                <ChefHat className="w-3.5 h-3.5" />
                STEP {activeStep.stepNumber || safeIndex + 1} OF {totalSteps}
              </span>

              <div className="flex items-center gap-2 text-xs">
                {activeStep.durationText && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    {activeStep.durationText}
                  </span>
                )}
                {activeStep.heatLevel && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    {activeStep.heatLevel}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
                {activeStep.title || `Cooking Step ${safeIndex + 1}`}
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-700 leading-relaxed">
                {activeStep.instruction}
              </p>
            </div>

            {activeStep.tip && (
              <div className="p-3.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs sm:text-sm text-emerald-900 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Chef Tip:</strong> {activeStep.tip}
                </span>
              </div>
            )}

            {/* Step Controls: Mark Complete + Previous / Next */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  toggleStepCompleted(activeStep.stepNumber || safeIndex + 1)
                }
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold border transition-colors ${
                  completedSteps[activeStep.stepNumber || safeIndex + 1]
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {completedSteps[activeStep.stepNumber || safeIndex + 1]
                    ? "Step Completed"
                    : "Mark Step Complete"}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeIndex === 0}
                  onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={safeIndex >= totalSteps - 1}
                  onClick={() => {
                    setCompletedSteps((prev) => ({
                      ...prev,
                      [activeStep.stepNumber || safeIndex + 1]: true,
                    }));
                    setCurrentStepIndex((i) => Math.min(totalSteps - 1, i + 1));
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* All Cooking Steps Timeline */}
          <div className="bg-white rounded-lg border border-slate-200/90 p-5 sm:p-6 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              All Cooking Steps ({totalSteps})
            </h3>
            <div className="space-y-2.5">
              {steps.map((step, idx) => {
                const stepNum = step.stepNumber || idx + 1;
                const isCurrent = idx === safeIndex;
                const isDone = Boolean(completedSteps[stepNum]);

                return (
                  <div
                    key={stepNum}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`p-3.5 rounded-md border cursor-pointer transition-all flex items-start gap-3 ${
                      isCurrent
                        ? "border-emerald-500 bg-emerald-50/40"
                        : isDone
                        ? "border-slate-200 bg-slate-50 opacity-75"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStepCompleted(stepNum);
                      }}
                      className="mt-0.5 text-emerald-600"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Step {stepNum}: {step.title}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {step.durationText} &bull; {step.heatLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {step.instruction}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chef Tips, Substitutions & Serving Suggestions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cooking Tips */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5" />
                Chef Cooking Tips
              </h3>
              <ul className="space-y-2 text-xs text-slate-600">
                {(instructions.cookingTips || []).map((tip, i) => (
                  <li key={i} className="leading-relaxed">
                    &bull; {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Substitutions */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 mb-2.5">
                <Repeat className="w-3.5 h-3.5" />
                Possible Substitutions
              </h3>
              <div className="space-y-2 text-xs text-slate-600">
                {(instructions.substitutions || []).length === 0 ? (
                  <p>Use standard pantry equivalents as needed.</p>
                ) : (
                  instructions.substitutions.map((sub, i) => (
                    <div key={i}>
                      <span className="font-bold text-slate-800">
                        {sub.ingredient}:
                      </span>{" "}
                      <span>{sub.substitute}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Serving Suggestions */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5 mb-2.5">
                <Utensils className="w-3.5 h-3.5" />
                Serving Suggestions
              </h3>
              <ul className="space-y-2 text-xs text-slate-600">
                {(instructions.servingSuggestions || []).map((idea, i) => (
                  <li key={i} className="leading-relaxed">
                    &bull; {idea}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
