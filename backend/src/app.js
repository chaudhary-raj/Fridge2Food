/**
 * Fridge2Food — Express Application Setup
 */

const express = require("express");
const cors = require("cors");
const config = require("./config");
const apiRoutes = require("./routes/apiRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Configure CORS safely
const allowedOrigins = config.corsOrigin
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow localhost / 127.0.0.1 ports during local development
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS policy"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Mount versioned API routes under both `/api` and `/api/v1`
app.use("/api", apiRoutes);
app.use("/api/v1", apiRoutes);

// Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
