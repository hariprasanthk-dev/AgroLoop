import { body } from "express-validator";
import { validate } from "./auth.validator";

const razorpayId = (field: string) =>
  body(field)
    .isString().withMessage(`${field} is required`)
    .trim()
    .notEmpty().withMessage(`${field} is required`)
    .isLength({ max: 100 }).withMessage(`${field} is too long`);

export const initiatePaymentValidator = [
  body("orderId").isMongoId().withMessage("A valid orderId is required"),
  validate,
];

export const verifyPaymentValidator = [
  razorpayId("razorpay_order_id"),
  razorpayId("razorpay_payment_id"),
  razorpayId("razorpay_signature"),
  body("razorpay_signature").matches(/^[0-9a-f]+$/i).withMessage("Invalid razorpay_signature"),
  validate,
];

export const paymentFailedValidator = [
  razorpayId("razorpay_order_id"),
  body("error_description").optional().isString().isLength({ max: 500 }),
  validate,
];
