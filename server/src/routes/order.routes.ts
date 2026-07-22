import { Router } from "express";
import * as OrderController from "../controllers/order.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import {
  createOrderValidator,
  updateOrderStatusValidator,
  cancelOrderValidator,
  orderActionValidator,
} from "../validators/order.validator";

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ─── Admin: Statistics ────────────────────────────────────────────────────────
router.get("/stats", authorize("admin"), OrderController.getOrderStats);

// ─── All Roles: List Orders (scoped in controller by role) ────────────────────
router.get("/", OrderController.listOrders);

// ─── Client: Place Order ──────────────────────────────────────────────────────
router.post(
  "/",
  authorize("client"),
  createOrderValidator,
  OrderController.createOrder
);

// ─── Client: Cancel Pending Order ─────────────────────────────────────────────
router.delete(
  "/:id",
  authorize("client"),
  cancelOrderValidator,
  OrderController.cancelOrder
);

// ─── Farmer: Accept Order ─────────────────────────────────────────────────────
router.put(
  "/:id/accept",
  authorize("farmer"),
  orderActionValidator,
  OrderController.acceptOrder
);

// ─── Farmer: Reject Order ─────────────────────────────────────────────────────
router.put(
  "/:id/reject",
  authorize("farmer"),
  orderActionValidator,
  OrderController.rejectOrder
);

// ─── Farmer: Advance Status (accepted→packed→shipped→delivered) ───────────────
router.put(
  "/:id/status",
  authorize("farmer"),
  updateOrderStatusValidator,
  OrderController.updateOrderStatus
);

// ─── All Roles: Get Single Order ─────────────────────────────────────────────
router.get("/:id", OrderController.getOrder);

export default router;
