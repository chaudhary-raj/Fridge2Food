import React, { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  UserPlus,
  Minus,
  Loader2,
} from "lucide-react";

export default function IngredientEditor({
  ingredients,
  ingredientsConfirmed,
  onAddIngredient,
  onUpdateIngredient,
  onRemoveIngredient,
  onConfirmAndSuggest,
  isGeneratingRecipes,
}) {
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("1 unit");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");

  // Optional preferences passed to Gemini Stage 1
  const [cuisinePref, setCuisinePref] = useState("");
  const [dietaryPref, setDietaryPref] = useState("");

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddIngredient(newName.trim(), newQuantity.trim() || "1 unit", 1);
    setNewName("");
    setNewQuantity("1 unit");
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQuantity(item.quantity || `${item.count || 1} unit`);
  };

  const saveEdit = (item) => {
    if (!editName.trim()) return;
    onUpdateIngredient(item.id, {
      name: editName.trim(),
      quantity: editQuantity.trim() || `${item.count || 1} unit`,
    });
    setEditingId(null);
  };

  const adjustCount = (item, delta) => {
    const nextCount = Math.max(1, (item.count || 1) + delta);
    onUpdateIngredient(item.id, {
      count: nextCount,
      quantity: `${nextCount} ${nextCount === 1 ? "unit" : "units"}`,
    });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 p-5 sm:p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Detected &amp; Editable Ingredients
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review, edit, or add items. Your confirmed list is the source of truth for recipes.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          {ingredients.length} {ingredients.length === 1 ? "Item" : "Items"}
        </span>
      </div>

      {/* Add Ingredient Manually Form */}
      <form
        onSubmit={handleAddSubmit}
        className="mt-4 flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add ingredient manually (e.g., Garlic, Spinach)..."
          className="flex-1 px-3.5 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <input
          type="text"
          value={newQuantity}
          onChange={(e) => setNewQuantity(e.target.value)}
          placeholder="Qty (e.g., 2 cups)"
          className="w-full sm:w-32 px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </form>

      {/* Ingredient List */}
      <div className="mt-4 flex-1 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {ingredients.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-md border border-dashed border-slate-200 bg-slate-50/50">
            <p className="text-sm font-semibold text-slate-700">
              No ingredients in your list yet
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ingredients you add or find in photos will appear here.
            </p>
          </div>
        ) : (
          ingredients.map((item) => {
            const isEditing = editingId === item.id;
            const sources = Array.isArray(item.sourceImages)
              ? item.sourceImages
              : [];

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-md border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {isEditing ? (
                  <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-400 text-sm font-medium focus:outline-none"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      placeholder="Quantity"
                      className="w-full sm:w-32 px-3 py-1.5 rounded-lg border border-emerald-400 text-sm focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => saveEdit(item)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Save changes"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {item.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.quantity || `${item.count || 1} unit`}
                        </span>
                        {item.isManual ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <UserPlus className="w-3 h-3" />
                            Manual
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-200/75 text-slate-700">
                            Confidence:{" "}
                            {item.confidencePercentage ||
                              Math.round((item.maxConfidence || 0.9) * 100)}
                            %
                          </span>
                        )}
                      </div>

                      {/* Source Image Attribution */}
                      {sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <ImageIcon className="w-3 h-3 text-slate-400" />
                          <span>
                            Detected {item.count || 1}&times; in{" "}
                            {sources.map((s) => s.filename).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quantity Stepper & Edit/Delete Controls */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => adjustCount(item, -1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-l-lg"
                          title="Decrease count"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-800">
                          {item.count || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustCount(item, 1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-r-lg"
                          title="Increase count"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Edit ingredient name or quantity"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveIngredient(item.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove ingredient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Optional Culinary Preferences & Confirm Ingredients Button */}
      <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Optional Cuisine Preference
            </label>
            <input
              type="text"
              value={cuisinePref}
              onChange={(e) => setCuisinePref(e.target.value)}
              placeholder="Any (e.g., Italian, Indian, Asian)"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Optional Dietary Focus
            </label>
            <input
              type="text"
              value={dietaryPref}
              onChange={(e) => setDietaryPref(e.target.value)}
              placeholder="Any (e.g., Vegetarian, High-Protein)"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={ingredients.length === 0 || isGeneratingRecipes}
          onClick={() =>
            onConfirmAndSuggest({
              cuisine: cuisinePref,
              dietary: dietaryPref,
            })
          }
          className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-md text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingRecipes ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Finding recipes…</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Confirm Ingredients &amp; Find Recipes ({ingredients.length})
              </span>
              <Sparkles className="w-4 h-4 ml-1" />
            </>
          )}
        </button>

        {ingredientsConfirmed && (
          <p className="text-center text-xs text-emerald-700 font-medium">
            Ingredients confirmed! Click above anytime to refresh suggestions.
          </p>
        )}
      </div>
    </div>
  );
}
