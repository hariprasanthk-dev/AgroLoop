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

  // ─── Handle MongoDB Network / Connection errors ────────────────────────────
  // These occur when MongoDB Atlas drops the connection or bufferCommands
  // times out. Map them to a 503 so the client can show a friendly message.
  const errName = (err as Error).name ?? "";
  const errMsg  = (err as Error).message ?? "";
  const isMongoNetworkError =
    errName === "MongoNetworkError" ||
    errName === "MongoServerSelectionError" ||
    errMsg.includes("buffering timed out") ||
    errMsg.includes("Connection closed") ||
    errMsg.includes("ECONNREFUSED");

  if (isMongoNetworkError) {
    error = new ApiError(
      503,
      "Service temporarily unavailable. Please try again in a moment.",
      [],
      true
    );
  }

  // ─── Default to ApiError or 500 ───────────────────────────────────────────
  const isApiError = error instanceof ApiError;
  const apiError = isApiError
    ? (error as ApiError)
    : new ApiError(500, "Internal server error", [], false);

  // ─── Log original error if it wasn't already an ApiError ──────────────────
  // This ensures the real cause (e.g. MongoNetworkError, Cloudinary error)
  // is captured in the logs before being wrapped into a generic 500.
  if (!isApiError) {
    logger.error({ originalErr: err }, "Unhandled error converted to 500");
  }

  // ─── Sentry: capture unexpected 5xx errors ─────────────────────────────────
  if (apiError.statusCode >= 500) {
    Sentry.setExtra("method", req.method);
    Sentry.setExtra("url", req.originalUrl);
    Sentry.setExtra("statusCode", apiError.statusCode);
    // Capture the original error for better Sentry context
    Sentry.captureException(isApiError ? apiError : err);
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
