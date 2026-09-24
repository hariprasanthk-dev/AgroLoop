import mongoose from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/Order.model";
import InventoryBatch from "../models/InventoryBatch.model";
import Payment, { PaymentDocument } from "../models/Payment.model";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { PaginationMeta } from "../types";
import { logger } from "../config/logger";
import { assertOrderAccess, Actor } from "./order.service";
import { notify, emitOrderUpdated, formatOrderRef } from "./notification.service";

// ─── Razorpay instance (lazy) ─────────────────────────────────────────────────
const getRazorpay = (): Razorpay => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw ApiError.internal("Razorpay credentials not configured");
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
};

/** Constant-time comparison of two hex-encoded HMAC digests. */
const hexDigestsMatch = (expectedHex: string, receivedHex: string): boolean => {
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const getFarmerIdForOrder = async (inventoryBatchId: mongoose.Types.ObjectId) => {
  const batch = await InventoryBatch.findById(inventoryBatchId).select("farmerId").lean();
  return batch ? batch.farmerId.toString() : null;
};

// ─── Initiate Payment ─────────────────────────────────────────────────────────
/**
 * Creates a Razorpay order and upserts a pending Payment record.
 *
 * Payment is taken up-front: the client pays while the order is PENDING and
 * the farmer can only accept once the payment is verified. Any order that is
 * not cancelled and not yet paid can be paid (this also covers orders that
 * were accepted unpaid under the previous workflow).
 */
export const initiatePayment = async (
  orderId: string,
  clientId: string
): Promise<{
  razorpayOrderId: string;
  amount: number;
  currency: string;
  paymentDbId: string;
  key: string;
  orderDetails: { totalAmount: number; destination: string };
}> => {
  if (!mongoose.isValidObjectId(orderId)) throw ApiError.badRequest("Invalid order ID");

  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.clientId.toString() !== clientId)
    throw ApiError.forbidden("You can only pay for your own orders");
  if (order.paymentStatus === "paid")
    throw ApiError.badRequest("This order is already paid");
  if (order.orderStatus === "cancelled")
    throw ApiError.badRequest("This order has been cancelled and can no longer be paid");

  const existingPaid = await Payment.exists({ orderId: order._id, status: "paid" });
  if (existingPaid) throw ApiError.badRequest("This order is already paid");

  const razorpay = getRazorpay();
  const amountInPaise = Math.round(order.totalAmount * 100);

  let rzpOrder: { id: string };
  try {
    rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `order_${orderId.slice(-8)}_${Date.now()}`,
      notes: { orderId: orderId.toString(), clientId },
    });
  } catch (err) {
    // Razorpay rejects invalid keys / is unreachable. Log the provider's
    // detail, but give the client an actionable message instead of a bare 500.
    logger.error({ err, orderId }, "Razorpay order creation failed");
    throw new ApiError(
      502,
      "The payment provider could not start this payment. No money was taken — please try again in a moment."
    );
  }

  // A new attempt resets a previously failed payment back to pending.
  // The status filter guarantees a paid record is never overwritten.
  const payment = await Payment.findOneAndUpdate(
    { orderId: order._id, status: { $ne: "paid" } },
    {
      orderId: order._id,
      razorpayOrderId: rzpOrder.id,
      amount: order.totalAmount,
      currency: "INR",
      paymentMethod: "razorpay",
      status: "pending",
    },
    { upsert: true, returnDocument: "after" }
  );

  if (order.paymentStatus === "failed") {
    await Order.updateOne(
      { _id: order._id, paymentStatus: "failed" },
      { $set: { paymentStatus: "pending" } }
    );
  }

  return {
    razorpayOrderId: rzpOrder.id,
    amount: amountInPaise,
    currency: "INR",
    paymentDbId: payment._id.toString(),
    key: env.RAZORPAY_KEY_ID,
    orderDetails: {
      totalAmount: order.totalAmount,
      destination: order.destination,
    },
  };
};

// ─── Mark Paid (shared by client verification and the webhook) ──────────────
export interface MarkPaidResult {
  payment: PaymentDocument;
  orderId: string;
  /** True when the payment had already been recorded as paid (idempotent replay). */
  alreadyProcessed: boolean;
}

/**
 * Records a verified payment. Idempotent: the conditional update only
 * succeeds for a payment that is not yet paid, so repeated calls (client
 * retry, webhook + client racing) return the existing record and do NOT
 * create duplicate notifications.
 *
 * Callers must have verified the Razorpay signature before calling this.
 */
export const markPaymentPaid = async (
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<MarkPaidResult> => {
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId, status: { $ne: "paid" } },
    { $set: { paymentId: razorpayPaymentId, status: "paid", paidAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!payment) {
    const existing = await Payment.findOne({ razorpayOrderId });
    if (!existing) throw ApiError.notFound("Payment record not found");
    // Only reachable when the record is already paid.
    return { payment: existing, orderId: existing.orderId.toString(), alreadyProcessed: true };
  }

  const order = await Order.findOneAndUpdate(
    { _id: payment.orderId },
    { $set: { paymentStatus: "paid" } },
    { returnDocument: "after" }
  );

  if (order) {
    const ref = formatOrderRef(order._id);
    const amount = `₹${order.totalAmount.toLocaleString("en-IN")}`;
    const farmerId = await getFarmerIdForOrder(order.inventoryBatchId);

    await notify(order.clientId, {
      type: "payment_success",
      title: "Payment Successful",
      message: `Payment of ${amount} for order ${ref} has been received.`,
      relatedId: order._id,
    });

    if (farmerId) {
      await notify(farmerId, {
        type: "payment_success",
        title: "Payment Received",
        message: `Payment received for Order ${ref}.`,
        relatedId: order._id,
      });
    }

    if (order.orderStatus === "cancelled") {
      logger.warn(
        { orderId: order._id.toString(), razorpayOrderId },
        "Payment captured for a cancelled order — manual refund required"
      );
    }

    emitOrderUpdated(order._id, farmerId ? [order.clientId, farmerId] : [order.clientId]);
  }

  return { payment, orderId: payment.orderId.toString(), alreadyProcessed: false };
};

// ─── Verify Payment (client, after Razorpay Checkout succeeds) ─────────────
/**
 * Verifies the Razorpay HMAC-SHA256 checkout signature server-side, checks
 * that the payment belongs to the requesting client, then records it.
 */
export const verifyPayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  actor: Actor
): Promise<MarkPaidResult> => {
  if (!env.RAZORPAY_KEY_SECRET)
    throw ApiError.internal("Razorpay credentials not configured");

  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (!hexDigestsMatch(expectedSignature, razorpaySignature))
    throw ApiError.badRequest("Payment verification failed.");

  const existing = await Payment.findOne({ razorpayOrderId });
  if (!existing) throw ApiError.notFound("Payment record not found");

  const order = await Order.findById(existing.orderId).lean();
  if (!order) throw ApiError.notFound("Associated order not found");
  await assertOrderAccess(order, actor);

  return markPaymentPaid(razorpayOrderId, razorpayPaymentId);
};

// ─── Handle Failed Payment ────────────────────────────────────────────────────
/**
 * Records a failed payment attempt for the requesting client's order.
 *
 * Only a PENDING payment can become FAILED. A paid payment is final: an
 * attempt to fail it is rejected with 409 and nothing changes.
 */
export const markPaymentFailed = async (
  razorpayOrderId: string,
  actor: Actor,
  errorDescription?: string
): Promise<PaymentDocument> => {
  const existingPayment = await Payment.findOne({ razorpayOrderId });
  if (!existingPayment) throw ApiError.notFound("Payment record not found");

  const order = await Order.findById(existingPayment.orderId).lean();
  if (!order) throw ApiError.notFound("Associated order not found");
  await assertOrderAccess(order, actor);

  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId, status: "pending" },
    { $set: { status: "failed" } },
    { returnDocument: "after" }
  );

  if (!payment) {
    if (existingPayment.status === "paid") {
      throw ApiError.conflict("This payment has already been completed and cannot be marked as failed.");
    }
    // Already failed — nothing to do.
    return existingPayment;
  }

  await Order.updateOne(
    { _id: order._id, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "failed" } }
  );

  logger.warn(
    { razorpayOrderId, userId: actor.id },
    `Payment failed: ${errorDescription ?? "unknown error"}`
  );

  const farmerId = await getFarmerIdForOrder(order.inventoryBatchId);
  emitOrderUpdated(order._id, farmerId ? [order.clientId, farmerId] : [order.clientId]);

  return payment;
};

// ─── Razorpay Webhook ─────────────────────────────────────────────────────────
/**
 * Server-to-server reconciliation. Razorpay calls this even if the client's
 * browser closed before `/verify` ran, so a captured payment is never lost.
 *
 * Requires RAZORPAY_WEBHOOK_SECRET (set the same secret in the Razorpay
 * dashboard → Webhooks, events: payment.captured, payment.failed).
 */
export const handleWebhook = async (
  rawBody: Buffer | undefined,
  signature: string | undefined
): Promise<{ handled: boolean; event?: string }> => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw new ApiError(503, "Razorpay webhook is not configured on this server");
  }
  if (!rawBody || !signature) throw ApiError.badRequest("Missing webhook body or signature");

  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (!/^[0-9a-f]+$/i.test(signature) || !hexDigestsMatch(expected, signature)) {
    throw ApiError.badRequest("Invalid webhook signature");
  }

  const body = JSON.parse(rawBody.toString("utf8")) as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; error_description?: string } } };
  };
  const entity = body.payload?.payment?.entity;
  const razorpayOrderId = entity?.order_id;

  if (!razorpayOrderId || !entity?.id) return { handled: false, event: body.event };

  const known = await Payment.exists({ razorpayOrderId });
  if (!known) {
    logger.warn({ razorpayOrderId, event: body.event }, "Webhook for unknown Razorpay order — ignored");
    return { handled: false, event: body.event };
  }

  if (body.event === "payment.captured") {
    await markPaymentPaid(razorpayOrderId, entity.id);
    return { handled: true, event: body.event };
  }

  if (body.event === "payment.failed") {
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId, status: "pending" },
      { $set: { status: "failed" } },
      { returnDocument: "after" }
    );
    if (payment) {
      await Order.updateOne(
        { _id: payment.orderId, paymentStatus: { $ne: "paid" } },
        { $set: { paymentStatus: "failed" } }
      );
      logger.warn({ razorpayOrderId }, `Webhook payment failed: ${entity.error_description ?? "unknown"}`);
    }
    return { handled: true, event: body.event };
  }

  return { handled: false, event: body.event };
};

// ─── List Payments ────────────────────────────────────────────────────────────
interface ListPaymentsQuery {
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;   // admin filter
  isAdmin?: boolean;
}

interface PaymentListResult {
  payments: PaymentDocument[];
  pagination: PaginationMeta;
}

export const listPayments = async (
  query: ListPaymentsQuery
): Promise<PaymentListResult> => {
  const { page = 1, limit = 20, status, clientId, isAdmin = false } = query;
  const skip = (page - 1) * limit;

  const paymentFilter: Record<string, unknown> = {};
  if (status) paymentFilter.status = status;

  // Non-admins are always scoped to their own orders.
  if (!isAdmin || clientId) {
    const clientOrderIds = await Order.find(
      { clientId: new mongoose.Types.ObjectId(clientId) },
      "_id"
    ).lean();
    paymentFilter.orderId = { $in: clientOrderIds.map((o) => o._id) };
  }

  const [payments, total] = await Promise.all([
    Payment.find(paymentFilter)
      .populate({
        path: "orderId",
        select: "clientId inventoryBatchId quantityKg destination orderStatus paymentStatus totalAmount",
        populate: [
          { path: "clientId", select: "name email" },
          { path: "inventoryBatchId", select: "category" },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(paymentFilter),
  ]);

  return {
    payments,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Get Payment by Order ID ──────────────────────────────────────────────────
/** Returns the payment for an order the requester is allowed to see. */
export const getPaymentByOrderId = async (
  orderId: string,
  actor: Actor
): Promise<PaymentDocument> => {
  if (!mongoose.isValidObjectId(orderId)) throw ApiError.badRequest("Invalid order ID");

  const order = await Order.findById(orderId).lean();
  if (!order) throw ApiError.notFound("Payment not found for this order");
  await assertOrderAccess(order, actor);

  const payment = await Payment.findOne({ orderId }).populate("orderId");
  if (!payment) throw ApiError.notFound("Payment not found for this order");
  return payment;
};

// ─── Payment Statistics ───────────────────────────────────────────────────────
export const getPaymentStats = async () => {
  const [byStatus, recentRevenue] = await Promise.all([
    Payment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]),
    // Revenue by day (last 30 days)
    Payment.aggregate([
      { $match: { status: "paid", paidAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return { byStatus, recentRevenue };
};
