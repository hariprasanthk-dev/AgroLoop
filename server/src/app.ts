import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { corsOptions } from "./config/cors";
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

// ─── Request Logging ──────────────────────────────────────────────────────────
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
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

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
