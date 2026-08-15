import mongoose from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/Order.model";
import InventoryBatch from "../models/InventoryBatch.model";
import Payment, { PaymentDocument } from "../models/Payment.model";
import Notification from "../models/Notification.model";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { getIO } from "../socket/socket";
import { PaginationMeta } from "../types";
import { logger } from "../config/logger";

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

// ─── Safe socket emit ─────────────────────────────────────────────────────────
const emit = (room: string, event: string, payload: unknown): void => {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    // Non-critical
  }
};

// ─── Initiate Payment ─────────────────────────────────────────────────────────
/**
 * Creates a Razorpay order and upserts a pending Payment record.
 * Returns the data needed by Razorpay Checkout on the frontend.
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
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.clientId.toString() !== clientId)
    throw ApiError.forbidden("You can only pay for your own orders");
  if (order.paymentStatus === "paid")
    throw ApiError.badRequest("This order is already paid");
  if (!["accepted", "packed", "shipped", "delivered"].includes(order.orderStatus))
    throw ApiError.badRequest(
      "Payment is only available after the farmer accepts the order"
    );

  const razorpay = getRazorpay();
  const amountInPaise = Math.round(order.totalAmount * 100);

  const rzpOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `order_${orderId.slice(-8)}_${Date.now()}`,
    notes: { orderId: orderId.toString(), clientId },
  });

  const payment = await Payment.findOneAndUpdate(
    { orderId },
    {
      orderId,
      razorpayOrderId: rzpOrder.id,
      amount: order.totalAmount,
      currency: "INR",
      paymentMethod: "razorpay",
      status: "pending",
    },
    { upsert: true, new: true }
  );

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

// ─── Verify Payment ───────────────────────────────────────────────────────────
/**
 * Verifies Razorpay HMAC-SHA256 signature and marks payment + order as paid.
 * Notifies client via socket and persists a DB notification.
 */
export const verifyPayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): Promise<{ payment: PaymentDocument; orderId: string }> => {
  // ── Always verify — no environment bypass ────────────────────────────────
  if (!env.RAZORPAY_KEY_SECRET)
    throw ApiError.internal("Razorpay credentials not configured");

  const secret: string = env.RAZORPAY_KEY_SECRET;

  // HMAC-SHA256 signature check (Razorpay official algorithm)
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  // Use timing-safe comparison to prevent timing-based brute-force attacks
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  const receivedBuf = Buffer.from(razorpaySignature, "hex");

  const signaturesMatch =
    expectedBuf.length === receivedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, receivedBuf);

  if (!signaturesMatch)
    throw ApiError.badRequest("Payment verification failed.");

  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId },
    { paymentId: razorpayPaymentId, status: "paid", paidAt: new Date() },
    { new: true }
  );
  if (!payment) throw ApiError.notFound("Payment record not found");

  const order = await Order.findByIdAndUpdate(
    payment.orderId,
    { paymentStatus: "paid" },
    { new: true }
  );

  if (order) {
    // ── Notify client ─────────────────────────────────────────────────────────
    await Notification.create({
      userId: order.clientId,
      title: "Payment Successful 🎉",
      message: `Payment of ₹${order.totalAmount.toLocaleString("en-IN")} for your order has been received.`,
      type: "payment_success",
      relatedId: order._id,
    });

    emit(`user:${order.clientId.toString()}`, "payment:success", {
      orderId: order._id.toString(),
      amount: order.totalAmount,
      paymentId: razorpayPaymentId,
    });

    // ── Notify farmer ─────────────────────────────────────────────────────────
    // We need the InventoryBatch to resolve the farmerId (not stored on Order).
    const batch = await InventoryBatch.findById(order.inventoryBatchId).lean();
    if (batch) {
      const farmerRoom = `user:${batch.farmerId.toString()}`;
      const shortId = order._id.toString().slice(-6);

      // Real-time event — triggers the farmer's order store to re-fetch
      emit(farmerRoom, "payment:received", {
        orderId: order._id.toString(),
        amount: order.totalAmount,
        paymentStatus: "paid",
      });

      // Persistent DB notification visible in farmer's notification bell
      await Notification.create({
        userId: batch.farmerId,
        title: "💰 Payment Received",
        message: `Client paid ₹${order.totalAmount.toLocaleString("en-IN")} for order #${shortId}.`,
        type: "payment_success",
        relatedId: order._id,
      });
    }
  }

  return { payment, orderId: payment.orderId.toString() };
};

// ─── Handle Failed Payment ────────────────────────────────────────────────────
/**
 * Marks a payment as failed after verifying that the requesting user owns
 * the underlying order.  Admins may mark any payment as failed.
 *
 * @throws ApiError.notFound   – payment record does not exist
 * @throws ApiError.notFound   – linked order record does not exist
 * @throws ApiError.forbidden  – authenticated user is not the order owner
 */
export const markPaymentFailed = async (
  razorpayOrderId: string,
  clientId: string,
  isAdmin: boolean,
  errorDescription?: string
): Promise<PaymentDocument> => {
  // ── 1. Fetch the payment record first (no mutation yet) ───────────────────
  const existingPayment = await Payment.findOne({ razorpayOrderId });
  if (!existingPayment) throw ApiError.notFound("Payment record not found");

  // ── 2. Load the associated order ─────────────────────────────────────────
  const order = await Order.findById(existingPayment.orderId);
  if (!order) throw ApiError.notFound("Associated order not found");

  // ── 3. Ownership check — admins are always permitted ─────────────────────
  if (!isAdmin && order.clientId.toString() !== clientId) {
    throw ApiError.forbidden(
      "You are not authorized to mark this payment as failed"
    );
  }

  // ── 4. Authorised — now apply the status change ───────────────────────────
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId },
    { status: "failed" },
    { new: true }
  ) as PaymentDocument;

  logger.warn(
    { razorpayOrderId, clientId, isAdmin },
    `⚠️ Payment failed: ${errorDescription ?? "unknown error"}`
  );

  return payment;
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

  // Build payment filter
  const paymentFilter: Record<string, unknown> = {};
  if (status) paymentFilter.status = status;

  // For non-admin: scope by client's own orders
  if (!isAdmin && clientId) {
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
        select: "clientId quantityKg destination orderStatus totalAmount",
        populate: { path: "clientId", select: "name email" },
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
export const getPaymentByOrderId = async (
  orderId: string
): Promise<PaymentDocument> => {
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
