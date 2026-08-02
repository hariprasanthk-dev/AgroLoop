import { body } from "express-validator";
import { validate } from "./auth.validator";

export const createInventoryValidator = [
  body("category")
    .notEmpty().withMessage("Category is required")
    .isIn(["fresh", "sprouted", "rotten"]).withMessage("Category must be fresh, sprouted, or rotten"),

  body("quantityKg")
    .notEmpty().withMessage("Quantity is required")
    .isFloat({ min: 0.1 }).withMessage("Quantity must be at least 0.1 kg"),

  body("pricePerKg")
    .notEmpty().withMessage("Price per kg is required")
    .isFloat({ min: 0 }).withMessage("Price must be a positive number"),

  body("location")
    .notEmpty().withMessage("Location is required")
    .isLength({ min: 2, max: 100 }).withMessage("Location must be between 2 and 100 characters"),

  body("harvestDate")
    .optional()
    .isISO8601().withMessage("Harvest date must be a valid date"),

  body("intakeDate")
    .optional()
    .isISO8601().withMessage("Intake date must be a valid date"),

  body("imageUrl")
    .optional({ checkFalsy: true })
    .isURL().withMessage("Image URL must be a valid URL"),

  body("description")
    .optional()
    .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

  validate,
];

export const updateInventoryValidator = [
  body("category")
    .optional()
    .isIn(["fresh", "sprouted", "rotten"]).withMessage("Invalid category"),

  body("quantityKg")
    .optional()
    .isFloat({ min: 0.1 }).withMessage("Quantity must be at least 0.1 kg"),

  body("pricePerKg")
    .optional()
    .isFloat({ min: 0 }).withMessage("Price must be a positive number"),

  body("status")
    .optional()
    .isIn(["available", "reserved", "sold", "expired"]).withMessage("Invalid status"),

  body("location")
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage("Location must be between 2 and 100 characters"),

  body("harvestDate")
    .optional()
    .isISO8601().withMessage("Harvest date must be a valid date"),

  body("imageUrl")
    .optional({ checkFalsy: true })
    .isURL().withMessage("Image URL must be a valid URL"),

  body("description")
    .optional()
    .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

  validate,
];
