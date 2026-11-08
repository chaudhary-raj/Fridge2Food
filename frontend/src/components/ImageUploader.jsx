import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Images,
  Refrigerator,
  X,
  Trash2,
  ScanSearch,
  AlertTriangle,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { formatBytes } from "../utils/colors";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function ImageUploader({
  onRunDetection,
  isDetecting,
  uploadProgress,
}) {
  // Upload mode: "multi" (Multiple Individual Images) or "fridge" (Single Fridge Image)
  const [uploadMode, setUploadMode] = useState("multi");
  const [stagedFiles, setStagedFiles] = useState([]); // [{ id, file, previewUrl }]
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.4);
  const fileInputRef = useRef(null);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      stagedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [stagedFiles]);

  const validateAndStageFiles = (fileList) => {
    setLocalError(null);
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const validItems = [];
    for (const file of incoming) {
      const mime = (file.type || "").toLowerCase();
      const extValid = /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!ALLOWED_TYPES.includes(mime) && !extValid) {
        setLocalError(
          `Unsupported format for "${file.name}". Please upload JPG, JPEG, PNG, or WEBP images.`
        );
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setLocalError(
          `"${file.name}" exceeds the 10 MB limit (${formatBytes(file.size)}).`
        );
        continue;
      }
      validItems.push({
        id: `staged_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (validItems.length === 0) return;

    if (uploadMode === "fridge") {
      // Single fridge photo mode replaces current staged image with the first selected photo
      stagedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setStagedFiles([validItems[0]]);
    } else {
      setStagedFiles((prev) => {
        const combined = [...prev, ...validItems];
        if (combined.length > 10) {
          setLocalError("Maximum of 10 images can be uploaded per batch.");
          return combined.slice(0, 10);
        }
        return combined;
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isDetecting) return;
    validateAndStageFiles(e.dataTransfer.files);
  };

  const handleRemoveStaged = (id) => {
    setStagedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAllStaged = () => {
    stagedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setStagedFiles([]);
    setLocalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDetectSubmit = async () => {
    if (stagedFiles.length === 0 || isDetecting) return;
    setLocalError(null);
    try {
      const rawFiles = stagedFiles.map((item) => item.file);
      await onRunDetection(rawFiles, uploadMode, confidenceThreshold);
      // Clear staging area after successful detection so user can upload more in the same session
      handleClearAllStaged();
    } catch {
      // Error is handled and displayed by context
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 p-5 sm:p-6">
      {/* Mode Switcher: Multiple Individual Images vs Single Fridge Image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Add photos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Use a fridge photo or take separate photos of your ingredients.
          </p>
        </div>

        <div className="inline-flex rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setUploadMode("multi")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              uploadMode === "multi"
                ? "bg-white text-emerald-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Images className="w-4 h-4" />
            <span>Multiple Individual Images</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMode("fridge");
              if (stagedFiles.length > 1) {
                setStagedFiles((prev) => prev.slice(0, 1));
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              uploadMode === "fridge"
                ? "bg-white text-emerald-700"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Refrigerator className="w-4 h-4" />
            <span>Single Fridge Image</span>
          </button>
        </div>
      </div>

      {/* Mode Description Banner */}
      <div className="mt-4 px-3.5 py-2.5 rounded-md bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-900 flex items-center justify-between gap-2">
        <span>
          {uploadMode === "multi"
            ? "Mode A — Upload multiple separate photos (e.g., one image of tomatoes, one of onions, one of potatoes)."
            : "Mode B — Upload a single wide photograph of your open fridge or countertop containing multiple food ingredients."}
        </span>
        <span className="font-semibold shrink-0 text-emerald-700">
          JPG, PNG, WEBP &bull; Max 10 MB
        </span>
      </div>

      {/* Drag and Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDetecting) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => !isDetecting && fileInputRef.current?.click()}
        className={`mt-4 relative border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/60"
            : "border-slate-300 hover:border-emerald-500 hover:bg-slate-50/70"
        } ${isDetecting ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple={uploadMode === "multi"}
          onChange={(e) => validateAndStageFiles(e.target.files)}
          className="hidden"
        />

        <div className="mx-auto w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Drag &amp; drop your {uploadMode === "fridge" ? "fridge photo" : "ingredient images"} here
        </p>
        <p className="text-xs text-slate-500 mt-1">
          or{" "}
          <span className="text-emerald-600 font-semibold underline">
            browse files
          </span>{" "}
          from your computer
        </p>
      </div>

      {/* Local Validation Error */}
      {localError && (
        <div className="mt-4 p-3 rounded-md bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{localError}</span>
        </div>
      )}

      {/* Staged Image Previews Before Processing */}
      {stagedFiles.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Staged for Detection ({stagedFiles.length}{" "}
              {stagedFiles.length === 1 ? "image" : "images"})
            </h3>
            <button
              type="button"
              onClick={handleClearAllStaged}
              disabled={isDetecting}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {stagedFiles.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-md overflow-hidden border border-slate-200 bg-slate-100 aspect-square"
              >
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent p-2">
                  <p className="text-[11px] font-medium text-white truncate">
                    {item.file.name}
                  </p>
                  <p className="text-[10px] text-slate-300">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveStaged(item.id);
                  }}
                  disabled={isDetecting}
                  title="Remove image"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/75 text-white hover:bg-rose-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Threshold Control & Detect Button */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <label
            htmlFor="conf-slider"
            className="text-xs font-medium text-slate-600 whitespace-nowrap"
          >
            Minimum confidence:{" "}
            <span className="font-bold text-emerald-700">
              {Math.round(confidenceThreshold * 100)}%
            </span>
          </label>
          <input
            id="conf-slider"
            type="range"
            min="0.15"
            max="0.85"
            step="0.05"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            disabled={isDetecting}
            className="w-28 sm:w-36 accent-emerald-600 cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={handleDetectSubmit}
          disabled={stagedFiles.length === 0 || isDetecting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDetecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Finding ingredients…</span>
            </>
          ) : (
            <>
              <ScanSearch className="w-4 h-4" />
              <span>
                Ingredients{" "}
                {stagedFiles.length > 0 ? `(${stagedFiles.length})` : ""}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Upload & Inference Progress Bar */}
      {isDetecting && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span>
              {uploadProgress < 100
                ? `Uploading image batch (${uploadProgress}%)...`
                : "Checking your photos…"}
            </span>
            <span className="font-semibold text-emerald-700">
              {uploadProgress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(10, uploadProgress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
