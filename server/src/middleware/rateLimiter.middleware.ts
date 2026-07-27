import rateLimit from "express-rate-limit";

// ─── Auth Limiter ─────────────────────────────────────────────────────────────
// Applied to: POST /api/auth/login, /api/auth/register, /api/auth/forgot-password
// Strict limit to prevent brute-force and credential-stuffing attacks.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message:
      "Too many authentication attempts. Please try again after 15 minutes.",
  },
  statusCode: 429,
  skipSuccessfulRequests: false,
});

// ─── General API Limiter ──────────────────────────────────────────────────────
// Applied to all /api/* routes EXCEPT auth and payment routes.
// Provides a generous ceiling for normal usage.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again after 15 minutes.",
  },
  statusCode: 429,
});

// ─── Payment Limiter ──────────────────────────────────────────────────────────
// Applied to: /api/payments/* routes.
// Tighter limit to prevent payment abuse and fraud attempts.
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many payment requests. Please try again after 15 minutes.",
  },
  statusCode: 429,
});
