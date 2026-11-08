import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Sparkles,
  Cpu,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useSession } from "../context/SessionContext";
import ImageUploader from "../components/ImageUploader";
import AnnotatedImageViewer from "../components/AnnotatedImageViewer";
import IngredientEditor from "../components/IngredientEditor";

export default function DetectionPage() {
  const navigate = useNavigate();
  const {
    processedImages,
    ingredients,
    ingredientsConfirmed,
    recipeSuggestions,
    inferenceMeta,
    isDetecting,
    uploadProgress,
    isGeneratingRecipes,
    errorMessage,
    setErrorMessage,
    runDetection,
    deleteProcessedImage,
    addManualIngredient,
    updateIngredientItem,
    removeIngredientItem,
    confirmIngredientsAndSuggestRecipes,
  } = useSession();

  const handleConfirmAndNavigate = async (preferences) => {
    try {
      const recipes = await confirmIngredientsAndSuggestRecipes(preferences);
      if (recipes && recipes.length > 0) {
        navigate("/recipes");
      }
    } catch {
      // Error displayed via banner
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Title & Quick Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
            What’s in your kitchen?
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Add a photo or type your ingredients, then choose a recipe.
          </p>
        </div>

        {recipeSuggestions.length > 0 && (
          <button
            type="button"
            onClick={() => navigate("/recipes")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>View {recipeSuggestions.length} Recipe Suggestions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-sm text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Action Required</p>
              <p className="text-xs sm:text-sm mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold text-rose-600 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Inference Metadata Banner when Available */}
      {inferenceMeta && (
        <div className="px-4 py-2.5 rounded-md bg-slate-900 text-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>
              Model: <strong className="text-white">{inferenceMeta.modelName}</strong>
            </span>
            <span className="text-slate-500">&bull;</span>
            <span>
              Device: <strong className="text-emerald-400">{inferenceMeta.device}</strong>
            </span>
            <span className="text-slate-500">&bull;</span>
            <span>
              Threshold: <strong>{Math.round((inferenceMeta.confidenceThreshold || 0.4) * 100)}%</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Batch processed in {inferenceMeta.totalInferenceTimeMs} ms</span>
          </div>
        </div>
      )}

      {/* Two-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Uploader + Annotated Image Viewer */}
        <div className="lg:col-span-7 space-y-6">
          <ImageUploader
            onRunDetection={runDetection}
            isDetecting={isDetecting}
            uploadProgress={uploadProgress}
          />

          <AnnotatedImageViewer
            images={processedImages}
            onRemoveImage={deleteProcessedImage}
          />
        </div>

        {/* Right Column: Editable Ingredient List & Confirm Trigger */}
        <div className="lg:col-span-5 lg:sticky lg:top-20">
          <IngredientEditor
            ingredients={ingredients}
            ingredientsConfirmed={ingredientsConfirmed}
            onAddIngredient={addManualIngredient}
            onUpdateIngredient={updateIngredientItem}
            onRemoveIngredient={removeIngredientItem}
            onConfirmAndSuggest={handleConfirmAndNavigate}
            isGeneratingRecipes={isGeneratingRecipes}
          />
        </div>
      </div>
    </div>
  );
}
