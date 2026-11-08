/**
 * Fridge2Food — Node.js / Express Backend Server Entry Point
 */

const app = require("./app");
const config = require("./config");
const geminiService = require("./services/geminiService");

const server = app.listen(config.port, () => {
  console.log("=============================================================");
  console.log(` Fridge2Food — Express Backend running on port ${config.port}`);
  console.log(` Health Endpoint:      http://localhost:${config.port}/api/health`);
  console.log(` FastAPI Service URL:  ${config.pythonServiceUrl}`);
  console.log(
    ` Gemini API Key:       ${
      geminiService.isConfigured()
        ? `Configured (${config.geminiModel})`
        : "NOT CONFIGURED (Set GEMINI_API_KEY in backend/.env)"
    }`
  );
  console.log("=============================================================");
});

// Graceful shutdown
const shutdown = () => {
  console.log("\nShutting down Fridge2Food Express Backend...");
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
