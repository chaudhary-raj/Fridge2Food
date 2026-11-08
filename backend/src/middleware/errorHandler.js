/**
 * Centralized Express Error Handling Middleware.
 * Ensures consistent JSON error structures and prevents leaking internal stack traces.
 */

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode =
    typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  if (statusCode >= 500) {
    console.error(`[Backend Error] ${req.method} ${req.originalUrl}:`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error:
      err.message ||
      "An unexpected server error occurred while processing your request.",
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
