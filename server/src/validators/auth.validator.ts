import { body, validationResult } from "express-validator";
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
    .isEmail().withMessage("Please enter a valid email"),

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
    .isEmail().withMessage("Please enter a valid email"),

  body("password")
    .notEmpty().withMessage("Password is required"),

  validate,
];
