import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import * as Sentry from "@sentry/node";
import { ApiError } from "../utils/ApiError";
import { ApiResponseShape } from "../types";
import { env } from "../config/env";
import { logger } from "../config/logger";

/**
 * Global error handler middleware.
 * Must be registered LAST in the Express middleware chain.
 *
 * Responsibilities:
 *  - Normalise Mongoose errors into ApiError instances
 *  - Report 5xx errors to Sentry (if configured)
 *  - Log every error with structured context via Pino
 *  - Return a consistent JSON error shape to the client
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let error = err;

  // ─── Handle Mongoose Validation Errors ────────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(422, "Validation failed", errors);
  }

  // ─── Handle Mongoose Duplicate Key Error ──────────────────────────────────
  if ((err as NodeJS.ErrnoException).code === "11000") {
    const field = Object.keys(
      (err as unknown as { keyValue: Record<string, unknown> }).keyValue
    )[0];
    error = new ApiError(409, `Duplicate value for field: ${field}`);
  }

  // ─── Handle Mongoose Cast Error (invalid ObjectId) ───────────────────────
  if (err instanceof mongoose.Error.CastError) {
    error = new ApiError(400, `Invalid value for field: ${err.path}`);
  }

  // ─── Default to ApiError or 500 ───────────────────────────────────────────
  const apiError =
    error instanceof ApiError ? error : new ApiError(500, "Internal server error", [], false);

  // ─── Sentry: capture unexpected 5xx errors ─────────────────────────────────
  if (apiError.statusCode >= 500) {
    Sentry.setExtra("method", req.method);
    Sentry.setExtra("url", req.originalUrl);
    Sentry.setExtra("statusCode", apiError.statusCode);
    Sentry.captureException(apiError);
  }

  // ─── Structured Pino log ──────────────────────────────────────────────────
  const logPayload = {
    statusCode: apiError.statusCode,
    method: req.method,
    url: req.originalUrl,
    err: apiError,
  };

  if (apiError.statusCode >= 500) {
    logger.error(logPayload, apiError.message);
  } else if (apiError.statusCode >= 400) {
    logger.warn(logPayload, apiError.message);
  }

  const responseBody: ApiResponseShape = {
    success: false,
    message: apiError.message,
    ...(apiError.errors.length > 0 && { errors: apiError.errors }),
    ...(env.NODE_ENV === "development" && {
      stack: apiError.stack,
    }),
  };

  res.status(apiError.statusCode).json(responseBody);
};

/**
 * 404 handler — catches any route that doesn't match.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};
