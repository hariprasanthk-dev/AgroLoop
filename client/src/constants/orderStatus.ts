import type { Order, OrderStatus, PaymentStatus, UserRole } from '../types';

/** Short, human-readable order reference — matches the server's notification text. */
export const formatOrderRef = (orderId: string): string =>
  `#ORD-${orderId.slice(-6).toUpperCase()}`;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending:   'Pending',
  accepted:  'Accepted',
  packaged:  'Packaged',
  shipped:   'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending:  'Payment Pending',
  paid:     'Paid',
  failed:   'Payment Failed',
  refunded: 'Refunded',
};

/** Fulfilment steps a farmer performs, in order. Mirrors the server's state machine. */
export const FARMER_NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  accepted: { to: 'packaged',  label: 'Mark as Packaged' },
  packaged: { to: 'shipped',   label: 'Mark as Shipped' },
  shipped:  { to: 'delivered', label: 'Mark as Delivered' },
};

/** Statuses from which a farmer (or admin) may cancel an order. */
export const CANCELLABLE_BY_FARMER: OrderStatus[] = ['pending', 'accepted', 'packaged', 'shipped'];

export const ORDER_STATUS_FILTERS: OrderStatus[] = [
  'pending', 'accepted', 'packaged', 'shipped', 'delivered', 'cancelled',
];

/** Older API responses may still contain the legacy "packed" value. */
export const normalizeOrderStatus = (status: string): OrderStatus =>
  (status === 'packed' ? 'packaged' : status) as OrderStatus;

/** A client can pay any order that is not cancelled and not yet paid. */
export const canClientPay = (order: Order): boolean =>
  order.orderStatus !== 'cancelled' && (order.paymentStatus === 'pending' || order.paymentStatus === 'failed');

/** Payment was taken but the order is cancelled — refunds are not automated. */
export const needsManualRefund = (order: Order): boolean =>
  order.orderStatus === 'cancelled' && order.paymentStatus === 'paid';

/** Base path of the order list that supports /:orderId deep links for a role. */
export const ordersPathFor = (role: UserRole): string | null =>
  role === 'farmer' ? '/farmer/orders' : role === 'client' ? '/client/orders' : null;
