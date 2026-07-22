import { Request } from "express";
import { Types } from "mongoose";

// ─── User ───────────────────────────────────────────────────────────────────

export type UserRole = "farmer" | "client" | "admin";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export type OnionCategory = "fresh" | "sprouted" | "rotten";
export type BatchStatus = "available" | "reserved" | "sold" | "expired";

export interface IInventoryBatch {
  _id: Types.ObjectId;
  farmerId: Types.ObjectId;
  category: OnionCategory;
  quantityKg: number;
  pricePerKg: number;
  harvestDate?: Date;
  intakeDate: Date;
  location: string;
  status: BatchStatus;
  imageUrl?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Order ───────────────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type OrderStatus =
  | "pending"
  | "accepted"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface IOrder {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  inventoryBatchId: Types.ObjectId;
  quantityKg: number;
  totalAmount: number;
  destination: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentMethod = "razorpay" | "cash" | "bank_transfer";

export interface IPayment {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  razorpayOrderId?: string;
  paymentId?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | "order_placed"
  | "order_accepted"
  | "order_packed"
  | "order_shipped"
  | "order_delivered"
  | "order_rejected"
  | "order_cancelled"
  | "payment_success"
  | "inventory_update"
  | "general";

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  relatedId?: Types.ObjectId;
  createdAt: Date;
}

// ─── Request Augmentation ────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string;
  };
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponseShape<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown[];
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── JWT Payload ─────────────────────────────────────────────────────────────

export interface JwtPayload {
  id: string;
  role: UserRole;
  email: string;
}
