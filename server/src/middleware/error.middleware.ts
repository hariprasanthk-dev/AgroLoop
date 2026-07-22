import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError";
import { ApiResponseShape } from "../types";
import { env } from "../config/env";

/**
 * Global error handler middleware.
 * Must be registered LAST in the Express middleware chain.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
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

  const responseBody: ApiResponseShape = {
    success: false,
    message: apiError.message,
    ...(apiError.errors.length > 0 && { errors: apiError.errors }),
    ...(env.NODE_ENV === "development" && {
      stack: apiError.stack,
    }),
  };

  console.error(`[${new Date().toISOString()}] ERROR ${apiError.statusCode}:`, apiError.message);

  res.status(apiError.statusCode).json(responseBody);
};

/**
 * 404 handler — catches any route that doesn't match.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};
