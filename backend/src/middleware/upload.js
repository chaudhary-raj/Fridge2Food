/**
 * Multer Upload Middleware & File Validation for Fridge2Food.
 *
 * Uses memoryStorage during initial inspection so invalid/malicious files
 * are rejected via magic-byte checks before ever touching temporary session storage.
 */

const path = require("path");
const multer = require("multer");
const config = require("../config");
const { sanitizeFilename, validateUploadedFile } = require("../utils/validators");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const safeName = sanitizeFilename(file.originalname);
  const ext = path.extname(safeName).toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  if (!config.allowedExtensions.has(ext) || !config.allowedMimeTypes.has(mime)) {
    const err = new Error(
      `Unsupported file format for '${safeName}'. Allowed formats: JPG, JPEG, PNG, and WEBP.`
    );
    err.statusCode = 400;
    return cb(err, false);
  }
  cb(null, true);
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxUploadSize,
    files: config.maxUploadCount,
  },
}).array("images", config.maxUploadCount);

/**
 * Express middleware that runs Multer and verifies binary magic bytes on all uploaded files.
 */
function uploadImagesMiddleware(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const maxMb = (config.maxUploadSize / (1024 * 1024)).toFixed(1);
          return res.status(400).json({
            success: false,
            error: `One or more files exceed the maximum allowed size of ${maxMb} MB per image.`,
          });
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            success: false,
            error: `Maximum of ${config.maxUploadCount} images can be uploaded in a single request.`,
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
        });
      }

      return res.status(err.statusCode || 400).json({
        success: false,
        error: err.message || "Invalid file upload.",
      });
    }

    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please select at least one image file (JPG, PNG, or WEBP) to upload.",
      });
    }

    for (const file of files) {
      const check = validateUploadedFile(file);
      if (!check.valid) {
        return res.status(400).json({
          success: false,
          error: check.error,
        });
      }
    }

    next();
  });
}

module.exports = {
  uploadImagesMiddleware,
};
