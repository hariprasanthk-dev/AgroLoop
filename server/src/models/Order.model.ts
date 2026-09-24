import mongoose, { Schema, Document, Model } from "mongoose";
import { IOrder, PaymentStatus, LEGACY_PACKAGED_STATUS } from "../types";

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
      // LEGACY_PACKAGED_STATUS stays in the enum only so documents written by
      // older versions remain valid; new transitions never write it.
      enum: [
        "pending",
        "accepted",
        "packaged",
        "shipped",
        "delivered",
        "cancelled",
        LEGACY_PACKAGED_STATUS,
      ] as string[],
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [300, "Notes cannot exceed 300 characters"],
    },
    // Append-only audit trail written atomically with each status change.
    // Orders created before this field existed simply have no history.
    statusHistory: {
      type: [
        {
          _id: false,
          status: { type: String, required: true },
          at: { type: Date, required: true },
          by: { type: String, enum: ["client", "farmer", "admin", "system"] },
        },
      ],
      default: [],
    },
    cancelledBy: {
      type: String,
      enum: ["client", "farmer", "admin"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      // Present legacy "packed" documents to API consumers as "packaged".
      transform: (_doc, ret: Record<string, unknown>) => {
        if (ret.orderStatus === LEGACY_PACKAGED_STATUS) ret.orderStatus = "packaged";
        return ret;
      },
    },
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
