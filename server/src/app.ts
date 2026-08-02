import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import { setupExpressErrorHandler } from "@sentry/node";
import { env } from "./config/env";
import { corsOptions } from "./config/cors";
import { logger } from "./config/logger";
import {
  authLimiter,
  apiLimiter,
  paymentLimiter,
} from "./middleware/rateLimiter.middleware";
import {
  noSqlSanitizer,
  xssSanitizer,
} from "./middleware/sanitize.middleware";

// Routes
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import inventoryRoutes from "./routes/inventory.routes";
import orderRoutes from "./routes/order.routes";
import paymentRoutes from "./routes/payment.routes";
import notificationRoutes from "./routes/notification.routes";
import adminRoutes from "./routes/admin.routes";
import uploadRoutes from "./routes/upload.routes";

// Middleware
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Multi-origin support: CLIENT_URL can be a comma-separated list.
// See src/config/cors.ts for the full allowlist logic.
app.use(cors(corsOptions));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Input Sanitization ──────────────────────────────────────────────────────
// Must run AFTER body parsing (needs req.body) and BEFORE route handlers.
// noSqlSanitizer: strips MongoDB operator keys (e.g. $gt, $ne) from req.body.
// xssSanitizer:   escapes HTML/script tags in req.body, req.params.
app.use(noSqlSanitizer);
app.use(xssSanitizer);

// ─── Request Logging (pino-http) ──────────────────────────────────────────────
// Replaces morgan with structured JSON logging.
// Silent in test environment to keep test output clean.
if (env.NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      logger,
      // Use 'warn' for 4xx, 'error' for 5xx, 'info' for everything else
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      // Keep response time in ms as a structured field
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
      // Redact Authorization header from access logs
      redact: ["req.headers.authorization", "req.headers.cookie"],
    })
  );
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "AgroLoop API is running",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API_PREFIX = "/api";

// Auth routes — strict limiter (10 req / 15 min) to block brute-force attacks
app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);

// Payment routes — tighter limiter (20 req / 15 min) to prevent fraud
app.use(`${API_PREFIX}/payments`, paymentLimiter, paymentRoutes);

// All other API routes — general limiter (100 req / 15 min)
app.use(`${API_PREFIX}/users`, apiLimiter, userRoutes);
app.use(`${API_PREFIX}/inventory`, apiLimiter, inventoryRoutes);
app.use(`${API_PREFIX}/orders`, apiLimiter, orderRoutes);
app.use(`${API_PREFIX}/notifications`, apiLimiter, notificationRoutes);
app.use(`${API_PREFIX}/admin`, apiLimiter, adminRoutes);
app.use(`${API_PREFIX}/upload`, apiLimiter, uploadRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── Sentry: Error Handler (Sentry v9) ────────────────────────────────────────
// Must be registered BEFORE the global errorHandler.
// setupExpressErrorHandler attaches an error-handling middleware that
// captures exceptions and sends them to Sentry before forwarding to next().
if (env.SENTRY_DSN) {
  setupExpressErrorHandler(app);
}

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
