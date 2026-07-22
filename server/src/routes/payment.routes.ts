import { Router } from "express";
import * as PaymentController from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate);

// ─── Admin: Statistics ────────────────────────────────────────────────────────
router.get("/stats", authorize("admin"), PaymentController.getPaymentStats);

// ─── All: List Payments (scoped by role in controller) ───────────────────────
router.get("/", authorize("client", "admin"), PaymentController.listPayments);

// ─── Client: Initiate Razorpay Order ─────────────────────────────────────────
router.post("/initiate", authorize("client"), PaymentController.initiatePayment);

// ─── Client: Verify Payment Signature ────────────────────────────────────────
router.post("/verify", authorize("client"), PaymentController.verifyPayment);

// ─── Client: Record Payment Failure ──────────────────────────────────────────
router.post("/failed", authorize("client"), PaymentController.handlePaymentFailed);

// ─── Client / Admin: Get Payment by Order ID ─────────────────────────────────
router.get("/:orderId", authorize("client", "admin"), PaymentController.getPayment);

export default router;
