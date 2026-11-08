/**
 * High-contrast, visually distinguishable color palette for YOLO11s bounding boxes.
 * Deterministic assignment by class index or ingredient name hash so the same
 * ingredient class always renders with the same color across all images.
 */

export const BBOX_PALETTE = [
  { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.16)", badgeBg: "#059669", text: "#ffffff" }, // Emerald
  { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.16)", badgeBg: "#d97706", text: "#ffffff" }, // Amber
  { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.16)", badgeBg: "#2563eb", text: "#ffffff" }, // Blue
  { stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.16)", badgeBg: "#db2777", text: "#ffffff" }, // Pink
  { stroke: "#8b5cf6", fill: "rgba(139, 92, 246, 0.16)", badgeBg: "#7c3aed", text: "#ffffff" }, // Violet
  { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.16)", badgeBg: "#dc2626", text: "#ffffff" }, // Red
  { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.16)", badgeBg: "#0891b2", text: "#ffffff" }, // Cyan
  { stroke: "#84cc16", fill: "rgba(132, 204, 22, 0.16)", badgeBg: "#65a30d", text: "#ffffff" }, // Lime
  { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.16)", badgeBg: "#ea580c", text: "#ffffff" }, // Orange
  { stroke: "#14b8a6", fill: "rgba(20, 184, 166, 0.16)", badgeBg: "#0d9488", text: "#ffffff" }, // Teal
];

export function getColorForClass(classId = 0, name = "") {
  if (typeof classId === "number" && classId >= 0) {
    return BBOX_PALETTE[classId % BBOX_PALETTE.length];
  }
  let hash = 0;
  const str = String(name || "item");
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return BBOX_PALETTE[Math.abs(hash) % BBOX_PALETTE.length];
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
