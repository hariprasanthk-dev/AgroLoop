import React from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';

// ─── Farmer's allowed next-status transitions ─────────────────────────────────
const NEXT_STATUS: Record<string, OrderStatus | null> = {
  accepted:  'packed',
  packed:    'shipped',
  shipped:   'delivered',
  delivered: null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  accepted: '📦 Mark as Packed',
  packed:   '🚚 Mark as Shipped',
  shipped:  '✅ Mark as Delivered',
};

export interface OrderActionsProps {
  order: Order;
  onAccept:  (id: string) => void;
  onReject:  (id: string) => void;
  onAdvance: (id: string, status: OrderStatus) => void;
  busyId: string | null;
}

/**
 * Renders the contextual action buttons for a farmer's order card.
 * - 'pending'  → Accept / Reject
 * - 'accepted' | 'packed' | 'shipped' → Advance to next status
 * - 'delivered' → No actions available
 */
const OrderActions: React.FC<OrderActionsProps> = ({ order, onAccept, onReject, onAdvance, busyId }) => {
  const isBusy = busyId === order._id;
  const next   = NEXT_STATUS[order.orderStatus];

  if (order.orderStatus === 'pending') {
    return (
      <div className="flex gap-2">
        <button
          id={`accept-order-${order._id}`}
          onClick={() => onAccept(order._id)}
          disabled={isBusy}
          className="btn-primary text-xs gap-1.5 flex-1 justify-center"
        >
          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Accept
        </button>
        <button
          id={`reject-order-${order._id}`}
          onClick={() => onReject(order._id)}
          disabled={isBusy}
          className="btn-secondary text-xs gap-1.5 flex-1 justify-center text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10"
        >
          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Reject
        </button>
      </div>
    );
  }

  if (next) {
    return (
      <button
        id={`advance-order-${order._id}`}
        onClick={() => onAdvance(order._id, next)}
        disabled={isBusy}
        className="btn-primary text-xs gap-1.5 w-full justify-center"
      >
        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {NEXT_STATUS_LABEL[order.orderStatus]}
      </button>
    );
  }

  return null;
};

export default OrderActions;
