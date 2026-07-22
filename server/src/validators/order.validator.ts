import { body, param } from "express-validator";
import { validate } from "./auth.validator";

export const createOrderValidator = [
  body("inventoryBatchId")
    .notEmpty().withMessage("Inventory batch ID is required")
    .isMongoId().withMessage("Invalid inventory batch ID"),

  body("quantityKg")
    .notEmpty().withMessage("Quantity is required")
    .isFloat({ min: 0.1 }).withMessage("Quantity must be at least 0.1 kg"),

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
    .isIn(["packed", "shipped", "delivered"])
    .withMessage("Farmers can only move orders to: packed, shipped, delivered"),

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
