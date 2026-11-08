/**
 * File validation, magic-byte inspection, and input sanitization utilities.
 */

const path = require("path");
const config = require("../config");

/**
 * Inspect file buffer magic bytes to confirm actual image content (JPG, PNG, WEBP)
 * so renamed executables or non-image files cannot bypass MIME checks.
 *
 * @param {Buffer} buffer
 * @returns {string|null} Detected MIME type or null if unrecognized
 */
function detectImageMimeFromMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WEBP: "RIFF" .... "WEBP"
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return "image/webp";
  }

  return null;
}

/**
 * Sanitize an uploaded filename to prevent path traversal or injection.
 *
 * @param {string} originalName
 * @returns {string}
 */
function sanitizeFilename(originalName = "image.jpg") {
  const base = path.basename(String(originalName || "image.jpg"));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "image.jpg";
}

/**
 * Sanitize user-entered text (e.g., ingredient names, quantities, filters).
 *
 * @param {string} value
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeText(value, maxLength = 80) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalize an ingredient name into Title Case for clean deduplication.
 *
 * @param {string} rawName
 * @returns {string}
 */
function normalizeIngredientName(rawName) {
  const cleaned = sanitizeText(rawName, 80)
    .replace(/[_-]+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Validate a session ID format to prevent directory traversal attacks.
 *
 * @param {string} sessionId
 * @returns {boolean}
 */
function isValidSessionId(sessionId) {
  if (typeof sessionId !== "string") return false;
  return /^[a-zA-Z0-9_-]{8,64}$/.test(sessionId);
}

/**
 * Validate an uploaded file object from Multer.
 *
 * @param {object} file
 * @returns {{ valid: boolean, error?: string, detectedMime?: string }}
 */
function validateUploadedFile(file) {
  if (!file || !file.buffer) {
    return { valid: false, error: "Empty or missing file upload." };
  }

  const safeName = sanitizeFilename(file.originalname);
  const ext = path.extname(safeName).toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  if (!config.allowedExtensions.has(ext) || !config.allowedMimeTypes.has(mime)) {
    return {
      valid: false,
      error: `File '${safeName}' has an unsupported format. Allowed formats: JPG, JPEG, PNG, and WEBP.`,
    };
  }

  if (file.size > config.maxUploadSize || file.buffer.length > config.maxUploadSize) {
    const maxMb = (config.maxUploadSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File '${safeName}' exceeds the maximum allowed size of ${maxMb} MB.`,
    };
  }

  const detectedMime = detectImageMimeFromMagicBytes(file.buffer);
  if (!detectedMime) {
    return {
      valid: false,
      error: `File '${safeName}' failed binary image content verification. Please upload a valid JPG, PNG, or WEBP image.`,
    };
  }

  return { valid: true, detectedMime };
}

module.exports = {
  detectImageMimeFromMagicBytes,
  sanitizeFilename,
  sanitizeText,
  normalizeIngredientName,
  isValidSessionId,
  validateUploadedFile,
};
