import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import * as PaymentService from "../services/payment.service";
import { AuthenticatedRequest } from "../types";

const actorOf = (req: AuthenticatedRequest) => ({ id: req.user!.id, role: req.user!.role });

// ─── Client: Initiate Razorpay Payment ───────────────────────────────────────
export const initiatePayment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { orderId } = req.body as { orderId: string };
    const data = await PaymentService.initiatePayment(orderId, req.user!.id);
    return ApiResponse.created(res, "Payment initiated", data);
  }
);

// ─── Client: Verify Razorpay Signature ───────────────────────────────────────
// Body fields are validated by verifyPaymentValidator.
export const verifyPayment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    };

    const result = await PaymentService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      actorOf(req)
    );
    return ApiResponse.ok(
      res,
      result.alreadyProcessed ? "Payment was already verified" : "Payment verified successfully",
      result
    );
  }
);

// ─── Client: Mark Payment Failed ──────────────────────────────────────────────
export const handlePaymentFailed = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { razorpay_order_id, error_description } = req.body as {
      razorpay_order_id: string;
      error_description?: string;
    };

    const payment = await PaymentService.markPaymentFailed(
      razorpay_order_id,
      actorOf(req),
      error_description
    );
    return ApiResponse.ok(res, "Payment failure recorded", payment);
  }
);

// ─── Razorpay Webhook (public, signature-verified) ───────────────────────────
export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await PaymentService.handleWebhook(
    (req as Request & { rawBody?: Buffer }).rawBody,
    req.header("x-razorpay-signature")
  );
  return ApiResponse.ok(res, "Webhook received", result);
});

// ─── All: List Payments (scoped by role) ─────────────────────────────────────
export const listPayments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const q = req.query as Record<string, string>;
    const isAdmin = req.user!.role === "admin";

    const result = await PaymentService.listPayments({
      page:     q.page   ? parseInt(q.page)   : 1,
      limit:    q.limit  ? Math.min(parseInt(q.limit), 100) : 20,
      status:   q.status || undefined,
      clientId: isAdmin ? (q.clientId || undefined) : req.user!.id,
      isAdmin,
    });

    return ApiResponse.ok(
      res,
      "Payments fetched",
      result.payments,
      result.pagination
    );
  }
);

// ─── Get Payment by Order ID ──────────────────────────────────────────────────
export const getPayment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const payment = await PaymentService.getPaymentByOrderId(
      String(req.params.orderId),
      actorOf(req)
    );
    return ApiResponse.ok(res, "Payment details fetched", payment);
  }
);

// ─── Admin: Payment Statistics ────────────────────────────────────────────────
export const getPaymentStats = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await PaymentService.getPaymentStats();
    return ApiResponse.ok(res, "Payment statistics fetched", stats);
  }
);
