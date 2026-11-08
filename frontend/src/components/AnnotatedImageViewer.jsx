import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Maximize2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Layers,
  Clock,
} from "lucide-react";
import { resolveSessionImageUrl } from "../services/api";
import { getColorForClass } from "../utils/colors";

/**
 * Renders an uploaded image alongside accurately scaled SVG bounding boxes and labels.
 * Because the SVG `viewBox` is bound to `0 0 ${dimensions.width} ${dimensions.height}`
 * with `preserveAspectRatio="xMidYMid meet"`, bounding box coordinates (`x1, y1, x2, y2`)
 * in original pixel space always align 1:1 with the displayed image at any screen width or zoom level.
 */
function AnnotatedCanvas({ imageItem, showAnnotations }) {
  const imgUrl = resolveSessionImageUrl(imageItem.imageUrl);
  const width = imageItem.dimensions?.width || 640;
  const height = imageItem.dimensions?.height || 640;
  const detections = Array.isArray(imageItem.detections)
    ? imageItem.detections
    : [];

  // Scale stroke width and font size proportionally to original image resolution
  const scaleFactor = Math.max(width, height) / 640;
  const strokeWidth = Math.max(2, Math.round(3 * scaleFactor));
  const fontSize = Math.max(12, Math.round(14 * scaleFactor));
  const labelHeight = Math.max(22, Math.round(24 * scaleFactor));

  return (
    <div className="relative w-full overflow-hidden rounded-md bg-slate-950 flex items-center justify-center">
      <div className="relative inline-block w-full">
        <img
          src={imgUrl}
          alt={imageItem.originalName}
          className="w-full h-auto block select-none"
        />

        {showAnnotations && (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {detections.map((det) => {
              const { x1, y1, width: boxW, height: boxH } = det.bbox;
              const color = getColorForClass(det.class_id, det.display_name);
              const labelText = `${det.display_name} ${det.confidence_percentage}%`;
              const approxLabelWidth = Math.min(
                width - x1,
                Math.max(80, labelText.length * (fontSize * 0.62) + 14)
              );
              const labelY = y1 >= labelHeight + 2 ? y1 - labelHeight : y1;

              return (
                <g key={det.detection_id}>
                  {/* Bounding box rectangle */}
                  <rect
                    x={x1}
                    y={y1}
                    width={Math.max(4, boxW)}
                    height={Math.max(4, boxH)}
                    fill={color.fill}
                    stroke={color.stroke}
                    strokeWidth={strokeWidth}
                    rx={4}
                  />
                  {/* Label pill background */}
                  <rect
                    x={x1}
                    y={labelY}
                    width={approxLabelWidth}
                    height={labelHeight}
                    fill={color.badgeBg}
                    rx={4}
                  />
                  {/* Ingredient name + confidence percentage */}
                  <text
                    x={x1 + 6 * scaleFactor}
                    y={labelY + labelHeight * 0.72}
                    fill={color.text}
                    fontSize={fontSize}
                    fontWeight="700"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

export default function AnnotatedImageViewer({ images, onRemoveImage }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const safeIndex = Math.min(selectedIndex, images.length - 1);
  const activeImage = images[safeIndex];

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 p-5 sm:p-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Visual Detection Results ({images.length}{" "}
              {images.length === 1 ? "Image" : "Images"})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch between original and annotated bounding-box views or click Expand to zoom.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Original vs Annotated */}
          <button
            type="button"
            onClick={() => setShowAnnotations((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showAnnotations
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {showAnnotations ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Annotated View</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Original Image</span>
              </>
            )}
          </button>

          {/* Open Lightbox Modal */}
          <button
            type="button"
            onClick={() => {
              setZoomScale(1);
              setLightboxOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Zoom / Expand</span>
          </button>

          {/* Delete Active Image */}
          <button
            type="button"
            onClick={() => onRemoveImage(activeImage.imageId)}
            title="Remove this image from session"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Image Selector Thumbnails (when multiple images uploaded) */}
      {images.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto py-3 border-b border-slate-100">
          {images.map((img, idx) => {
            const isSelected = idx === safeIndex;
            return (
              <button
                key={img.imageId}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`group relative shrink-0 w-20 h-16 rounded-md overflow-hidden border-2 transition-all ${
                  isSelected
                    ? "border-emerald-600 ring-2 ring-emerald-500/20"
                    : "border-slate-200 opacity-75 hover:opacity-100"
                }`}
              >
                <img
                  src={resolveSessionImageUrl(img.imageUrl)}
                  alt={img.originalName}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-900/80 text-white">
                  {img.detectionCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Annotated Canvas View */}
      <div className="mt-4">
        <AnnotatedCanvas
          imageItem={activeImage}
          showAnnotations={showAnnotations}
        />
      </div>

      {/* Per-Image Detection Metadata & Badges */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-800">
            {activeImage.originalName}
          </span>
          <span className="text-slate-400">&bull;</span>
          <span>
            {activeImage.dimensions?.width}&times;{activeImage.dimensions?.height}px
          </span>
          <span className="text-slate-400">&bull;</span>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
            {activeImage.detectionCount}{" "}
            {activeImage.detectionCount === 1 ? "detection" : "detections"}
          </span>
        </div>

        {activeImage.inferenceTimeMs > 0 && (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Inference: {activeImage.inferenceTimeMs} ms
          </span>
        )}
      </div>

      {/* Detection Pills for Current Image */}
      {activeImage.detections?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {activeImage.detections.map((det) => {
            const color = getColorForClass(det.class_id, det.display_name);
            return (
              <span
                key={det.detection_id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color.stroke }}
                />
                <span>{det.display_name}</span>
                <span className="text-[11px] font-bold text-slate-500">
                  {det.confidence_percentage}%
                </span>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          No ingredients passed the confidence threshold in this image. You can lower the confidence slider or add ingredients manually on the right.
        </p>
      )}

      {/* Fullscreen Lightbox Modal with Zoom Controls */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-bold">{activeImage.originalName}</h3>
              <p className="text-xs text-slate-400">
                {activeImage.dimensions?.width}&times;
                {activeImage.dimensions?.height}px &bull;{" "}
                {activeImage.detectionCount} detected items
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAnnotations((p) => !p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white"
              >
                {showAnnotations ? "Hide Boxes" : "Show Boxes"}
              </button>
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.max(0.5, z - 0.25))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-2">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.25))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white ml-2"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto flex items-center justify-center p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="transition-transform duration-150 origin-center max-w-5xl w-full"
              style={{ transform: `scale(${zoomScale})` }}
            >
              <AnnotatedCanvas
                imageItem={activeImage}
                showAnnotations={showAnnotations}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
