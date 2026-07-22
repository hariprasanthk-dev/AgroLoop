import mongoose, { Schema, Document, Model } from "mongoose";
import { IOrder, PaymentStatus, OrderStatus } from "../types";

export interface OrderDocument extends IOrder, Document {}

const OrderSchema = new Schema<OrderDocument>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Client ID is required"],
      index: true,
    },
    inventoryBatchId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryBatch",
      required: [true, "Inventory batch ID is required"],
      index: true,
    },
    quantityKg: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.1, "Quantity must be at least 0.1 kg"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    destination: {
      type: String,
      required: [true, "Destination is required"],
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"] as PaymentStatus[],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
      ] as OrderStatus[],
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [300, "Notes cannot exceed 300 characters"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Compound indexes ─────────────────────────────────────────────────────────
OrderSchema.index({ clientId: 1, orderStatus: 1 });
OrderSchema.index({ orderStatus: 1, paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });

const Order: Model<OrderDocument> = mongoose.model<OrderDocument>(
  "Order",
  OrderSchema
);

export default Order;
