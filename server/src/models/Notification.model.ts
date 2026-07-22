import mongoose, { Schema, Document, Model } from "mongoose";
import { INotification, NotificationType } from "../types";

export interface NotificationDocument extends INotification, Document {}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
    },
    type: {
      type: String,
      enum: [
        "order_placed",
        "order_accepted",
        "order_packed",
        "order_shipped",
        "order_delivered",
        "order_rejected",
        "order_cancelled",
        "payment_success",
        "inventory_update",
        "general",
      ] as NotificationType[],
      default: "general",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Compound index for unread notification queries ───────────────────────────
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

const Notification: Model<NotificationDocument> =
  mongoose.model<NotificationDocument>("Notification", NotificationSchema);

export default Notification;
