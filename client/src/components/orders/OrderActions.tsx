import React from 'react';
import { CheckCircle2, XCircle, Loader2, BoxIcon, Truck, PackageCheck, Clock, AlertTriangle } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { FARMER_NEXT_STEP, CANCELLABLE_BY_FARMER, normalizeOrderStatus } from '../../constants/orderStatus';

const NEXT_ICON: Partial<Record<OrderStatus, React.ReactNode>> = {
  packaged:  <BoxIcon className="w-3.5 h-3.5" />,
  shipped:   <Truck className="w-3.5 h-3.5" />,
  delivered: <PackageCheck className="w-3.5 h-3.5" />,
};

export interface OrderActionsProps {
  order: Order;
  onAccept:  (id: string) => void;
  /** Opens the reject/cancel confirmation — never cancels directly. */
  onCancel:  (order: Order) => void;
  onAdvance: (id: string, status: OrderStatus) => void;
  /** True while a request for this order is in flight (or just completed). */
  busy: boolean;
}

/**
 * Farmer actions for one order. Buttons mirror the server's state machine;
 * the server still enforces every rule, so a stale UI cannot skip a step.
 *
 * - pending + paid     → Accept Order / Reject
 * - pending + unpaid   → Accept disabled (waiting for payment) / Reject
 * - accepted           → Mark as Packaged   (+ Cancel)
 * - packaged           → Mark as Shipped    (+ Cancel)
 * - shipped            → Mark as Delivered  (+ Cancel)
 */
const OrderActions: React.FC<OrderActionsProps> = ({ order, onAccept, onCancel, onAdvance, busy }) => {
  const status = normalizeOrderStatus(order.orderStatus);
  const isPaid = order.paymentStatus === 'paid';
  const spinner = <Loader2 className="w-3.5 h-3.5 animate-spin" />;

  const cancelButton = CANCELLABLE_BY_FARMER.includes(status) && (
    <button
      id={`cancel-order-${order._id}`}
      onClick={() => onCancel(order)}
      disabled={busy}
      className="btn-secondary text-xs gap-1.5 justify-center text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10"
    >
      <XCircle className="w-3.5 h-3.5" />
      {status === 'pending' ? 'Reject' : 'Cancel Order'}
    </button>
  );

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex gap-2">
          {cancelButton}
          <button
            id={`accept-order-${order._id}`}
            onClick={() => onAccept(order._id)}
            disabled={busy || !isPaid}
            title={isPaid ? undefined : 'You can accept this order once the client has paid'}
            className="btn-primary text-xs gap-1.5 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? spinner : <CheckCircle2 className="w-3.5 h-3.5" />}
            Accept Order
          </button>
        </div>
        {!isPaid && (
          <p className={`text-[11px] flex items-center gap-1 ${order.paymentStatus === 'failed' ? 'text-red-300' : 'text-amber-300'}`}>
            {order.paymentStatus === 'failed'
              ? <><AlertTriangle className="w-3 h-3" /> Client's payment failed — waiting for a successful payment</>
              : <><Clock className="w-3 h-3" /> Waiting for the client's payment</>}
          </p>
        )}
      </div>
    );
  }

  const next = FARMER_NEXT_STEP[status];
  if (!next) return null; // delivered / cancelled — final states

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {cancelButton}
        <button
          id={`advance-order-${order._id}`}
          onClick={() => onAdvance(order._id, next.to)}
          disabled={busy || !isPaid}
          className="btn-primary text-xs gap-1.5 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? spinner : NEXT_ICON[next.to]}
          {next.label}
        </button>
      </div>
      {!isPaid && (
        <p className="text-[11px] text-amber-300 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Payment not received — fulfilment is blocked until it is
        </p>
      )}
    </div>
  );
};

export default OrderActions;
