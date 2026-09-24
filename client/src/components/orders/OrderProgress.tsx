import React from 'react';
import {
  CreditCard, CheckCircle2, BoxIcon, Truck, PackageCheck, XCircle, Check, Clock,
} from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { normalizeOrderStatus } from '../../constants/orderStatus';
import { formatDate } from '../../utils/helpers';

// Fulfilment steps, in order. Payment is shown as the first step but is
// computed from paymentStatus independently of the order status.
const FULFILMENT: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'accepted',  label: 'Accepted',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: 'packaged',  label: 'Packaged',  icon: <BoxIcon className="w-3.5 h-3.5" /> },
  { key: 'shipped',   label: 'Shipped',   icon: <Truck className="w-3.5 h-3.5" /> },
  { key: 'delivered', label: 'Delivered', icon: <PackageCheck className="w-3.5 h-3.5" /> },
];
const RANK: Record<string, number> = { pending: 0, accepted: 1, packaged: 2, shipped: 3, delivered: 4 };

type StepState = 'done' | 'current' | 'upcoming' | 'failed';

const dotClass: Record<StepState, string> = {
  done:     'bg-emerald-500 text-white',
  current:  'bg-blue-500/20 text-blue-300 ring-2 ring-blue-500/60',
  upcoming: 'bg-slate-700/60 text-slate-500',
  failed:   'bg-red-500/20 text-red-300 ring-2 ring-red-500/50',
};

interface OrderProgressProps {
  order: Pick<Order, 'orderStatus' | 'paymentStatus' | 'statusHistory' | 'cancelledBy'>;
  /** Show the date each step happened (from statusHistory, when available). */
  showTimestamps?: boolean;
}

/**
 * Step timeline: Payment → Accepted → Packaged → Shipped → Delivered.
 * Each step reflects the persisted order/payment state; nothing is inferred
 * from real-time events.
 */
const OrderProgress: React.FC<OrderProgressProps> = ({ order, showTimestamps = false }) => {
  const status = normalizeOrderStatus(order.orderStatus);
  const reachedAt = (s: OrderStatus) =>
    order.statusHistory?.find((h) => normalizeOrderStatus(h.status) === s)?.at;

  if (status === 'cancelled') {
    const at = reachedAt('cancelled');
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-red-300">
        <XCircle className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">
          Order cancelled{order.cancelledBy ? ` by the ${order.cancelledBy}` : ''}
          {showTimestamps && at ? ` · ${formatDate(at)}` : ''}
        </span>
      </div>
    );
  }

  const rank = RANK[status] ?? 0;
  const paymentState: StepState =
    order.paymentStatus === 'paid' ? 'done' : order.paymentStatus === 'failed' ? 'failed' : 'current';

  const steps: { key: string; label: string; icon: React.ReactNode; state: StepState; at?: string }[] = [
    {
      key: 'payment',
      label: order.paymentStatus === 'failed' ? 'Payment failed' : 'Payment',
      icon: paymentState === 'done' ? <Check className="w-3.5 h-3.5" />
          : paymentState === 'failed' ? <XCircle className="w-3.5 h-3.5" />
          : <CreditCard className="w-3.5 h-3.5" />,
      state: paymentState,
    },
    ...FULFILMENT.map((step, i) => {
      const stepRank = i + 1;
      let state: StepState = 'upcoming';
      if (stepRank <= rank) state = 'done';
      // The next fulfilment step is "current" only once payment is settled.
      else if (stepRank === rank + 1 && order.paymentStatus === 'paid') state = 'current';
      return {
        key: step.key,
        label: step.label,
        icon: state === 'done' ? <Check className="w-3.5 h-3.5" /> : state === 'current' ? <Clock className="w-3.5 h-3.5" /> : step.icon,
        state,
        at: reachedAt(step.key),
      };
    }),
  ];

  return (
    <ol className="flex items-start" aria-label="Order progress">
      {steps.map((step, i) => (
        <li key={step.key} className="flex-1 flex flex-col items-center min-w-0 relative">
          {i > 0 && (
            <span
              aria-hidden
              className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-0 ${
                step.state === 'done' ? 'bg-emerald-500' : 'bg-slate-700/60'
              }`}
            />
          )}
          <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center ${dotClass[step.state]}`}>
            {step.icon}
          </span>
          <span
            className={`mt-1.5 text-[11px] font-medium text-center leading-tight ${
              step.state === 'done' ? 'text-emerald-300'
              : step.state === 'current' ? 'text-blue-300'
              : step.state === 'failed' ? 'text-red-300'
              : 'text-slate-500'
            }`}
          >
            {step.label}
          </span>
          {showTimestamps && step.at && (
            <span className="text-[10px] text-slate-500 mt-0.5">{formatDate(step.at)}</span>
          )}
          <span className="sr-only">
            {step.state === 'done' ? 'completed' : step.state === 'current' ? 'in progress' : step.state === 'failed' ? 'failed' : 'not started'}
          </span>
        </li>
      ))}
    </ol>
  );
};

export default OrderProgress;
