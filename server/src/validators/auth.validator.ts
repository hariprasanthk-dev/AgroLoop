import { body, query, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Runs validation results and throws ApiError if any validation failed.
 */
export const validate = (req: Request, _res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    throw ApiError.badRequest("Validation failed", messages);
  }
  next();
};

// ─── Auth Validators ──────────────────────────────────────────────────────────

export const registerValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 60 }).withMessage("Name must be between 2 and 60 characters"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

  body("role")
    .optional()
    .isIn(["farmer", "client"]).withMessage("Role must be farmer or client"),

  validate,
];

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty().withMessage("Password is required"),

  validate,
];

// ─── Email Verification Validators ───────────────────────────────────────────

/**
 * Validates the ?token= query parameter in GET /api/auth/verify-email.
 */
export const verifyEmailValidator = [
  query("token")
    .notEmpty().withMessage("Verification token is required")
    .isLength({ min: 64, max: 64 }).withMessage("Invalid token format"),

  validate,
];

// ─── Password Reset Validators ────────────────────────────────────────────────

/**
 * Validates the email in POST /api/auth/forgot-password.
 * Deliberately minimal — we don't reveal whether the email exists.
 */
export const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email address")
    .normalizeEmail(),

  validate,
];

/**
 * Validates POST /api/auth/reset-password body.
 * Token must be the raw 64-char hex string from the email URL.
 * Password must meet the same minimum requirements as registration.
 */
export const resetPasswordValidator = [
  body("token")
    .notEmpty().withMessage("Reset token is required")
    .isLength({ min: 64, max: 64 }).withMessage("Invalid token format"),

  body("password")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

  body("confirmPassword")
    .optional()
    .custom((value, { req }) => {
      if (value && value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  validate,
];
