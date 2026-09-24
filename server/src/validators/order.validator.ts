import { body, param } from "express-validator";
import { validate } from "./auth.validator";

export const createOrderValidator = [
  body("inventoryBatchId")
    .notEmpty().withMessage("Inventory batch ID is required")
    .isMongoId().withMessage("Invalid inventory batch ID"),

  body("quantityKg")
    .notEmpty().withMessage("Quantity is required")
    .isFloat({ min: 0.1, max: 1_000_000 }).withMessage("Quantity must be between 0.1 kg and 1,000,000 kg")
    .toFloat(),

  body("destination")
    .trim()
    .notEmpty().withMessage("Destination is required")
    .isLength({ max: 200 }).withMessage("Destination cannot exceed 200 characters"),

  body("notes")
    .optional()
    .isLength({ max: 300 }).withMessage("Notes cannot exceed 300 characters"),

  validate,
];

// Used by farmer to advance order through its lifecycle
export const updateOrderStatusValidator = [
  param("id").isMongoId().withMessage("Invalid order ID"),

  body("orderStatus")
    .notEmpty().withMessage("Order status is required")
    // Accept the legacy spelling from older clients.
    .customSanitizer((v) => (v === "packed" ? "packaged" : v))
    .isIn(["packaged", "shipped", "delivered", "cancelled"])
    .withMessage("Order status must be one of: packaged, shipped, delivered, cancelled"),

  validate,
];

// Client cancels a pending order
export const cancelOrderValidator = [
  param("id").isMongoId().withMessage("Invalid order ID"),
  validate,
];

// Farmer accepts / rejects a pending order
export const orderActionValidator = [
  param("id").isMongoId().withMessage("Invalid order ID"),
  validate,
];
