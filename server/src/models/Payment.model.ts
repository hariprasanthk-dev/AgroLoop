import mongoose, { Schema, Document, Model } from "mongoose";
import { IPayment, PaymentStatus, PaymentMethod } from "../types";

export interface PaymentDocument extends IPayment, Document {}

const PaymentSchema = new Schema<PaymentDocument>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
      index: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    paymentId: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cash", "bank_transfer"] as PaymentMethod[],
      default: "razorpay",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"] as PaymentStatus[],
      default: "pending",
      index: true,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
PaymentSchema.index({ razorpayOrderId: 1 });
PaymentSchema.index({ paymentId: 1 });
PaymentSchema.index({ orderId: 1, status: 1 });

const Payment: Model<PaymentDocument> = mongoose.model<PaymentDocument>(
  "Payment",
  PaymentSchema
);

export default Payment;
