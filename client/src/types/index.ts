// ─── User ─────────────────────────────────────────────────────────────────────
export type UserRole = 'farmer' | 'client' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  createdAt: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export type OnionCategory = 'fresh' | 'sprouted' | 'rotten';
export type BatchStatus = 'available' | 'reserved' | 'sold' | 'expired';

export interface InventoryBatch {
  _id: string;
  farmerId: User | string;
  category: OnionCategory;
  quantityKg: number;
  pricePerKg: number;
  harvestDate?: string;
  intakeDate: string;
  location: string;
  status: BatchStatus;
  imageUrl?: string;
  description?: string;
  createdAt: string;
}

// ─── Order ────────────────────────────────────────────────────────────────────
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type OrderStatus =
  | 'pending' | 'accepted' | 'packed'
  | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  _id: string;
  clientId: User | string;
  inventoryBatchId: InventoryBatch | string;
  quantityKg: number;
  totalAmount: number;
  destination: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  notes?: string;
  createdAt: string;
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export type PaymentMethod = 'razorpay' | 'cash' | 'bank_transfer';

export interface Payment {
  _id: string;
  orderId: Order | string;
  razorpayOrderId?: string;
  paymentId?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paidAt?: string;
  createdAt: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType =
  | 'order_placed' | 'order_accepted' | 'order_packed'
  | 'order_shipped' | 'order_delivered'
  | 'order_rejected' | 'order_cancelled'
  | 'payment_success' | 'inventory_update' | 'general';

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  relatedId?: string;
  createdAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  pagination?: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  user: User;
  token: string;
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export interface InventoryStat {
  _id: OnionCategory;
  totalBatches: number;
  totalQuantityKg: number;
  availableQuantityKg: number;
}

export interface OrderStat {
  _id: OrderStatus;
  count: number;
  totalRevenue: number;
}

export interface AdminDashboardStats {
  totalFarmers: number;
  totalClients: number;
  totalInventoryKg: number;
  totalOrders: number;
  revenue: number;
  inventoryBreakdown: {
    fresh: number;
    sprouted: number;
    rotten: number;
  };
  orderBreakdown: {
    pending: number;
    accepted: number;
    packed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  paymentBreakdown: {
    totalCollected: number;
    completedCount: number;
    pendingCount: number;
  };
  wasteStats: {
    rottenKg: number;
    sproutedKg: number;
    freshKg: number;
    wasteReductionPercent: number;
  };
  salesHistory: Array<{
    _id: string; // date string YYYY-MM-DD
    revenue: number;
    count: number;
  }>;
}

// ─── Razorpay (third-party, no @types package) ────────────────────────────────
export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

export interface RazorpayInstance {
  on(event: 'payment.failed', handler: (response: { error: { description: string } }) => void): void;
  open(): void;
}

export interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

// Augments the browser Window global so `window.Razorpay` is typed everywhere.
declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}
