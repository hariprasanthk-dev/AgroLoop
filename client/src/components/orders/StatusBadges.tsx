import React from 'react';
import {
  CheckCircle2, Clock, XCircle, RotateCcw, CircleDot, BoxIcon, Truck, PackageCheck,
} from 'lucide-react';
import type { OrderStatus, PaymentStatus } from '../../types';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, normalizeOrderStatus } from '../../constants/orderStatus';

const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap';

const PAYMENT_STYLE: Record<PaymentStatus, { cls: string; icon: React.ReactNode }> = {
  paid:     { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  pending:  { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',       icon: <Clock className="w-3.5 h-3.5" /> },
  failed:   { cls: 'bg-red-500/15 text-red-300 border-red-500/30',             icon: <XCircle className="w-3.5 h-3.5" /> },
  refunded: { cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',       icon: <RotateCcw className="w-3.5 h-3.5" /> },
};

const ORDER_STYLE: Record<OrderStatus, { cls: string; icon: React.ReactNode }> = {
  pending:   { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',       icon: <Clock className="w-3.5 h-3.5" /> },
  accepted:  { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',          icon: <CircleDot className="w-3.5 h-3.5" /> },
  packaged:  { cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30',    icon: <BoxIcon className="w-3.5 h-3.5" /> },
  shipped:   { cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',          icon: <Truck className="w-3.5 h-3.5" /> },
  delivered: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: <PackageCheck className="w-3.5 h-3.5" /> },
  cancelled: { cls: 'bg-red-500/15 text-red-300 border-red-500/30',             icon: <XCircle className="w-3.5 h-3.5" /> },
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const style = PAYMENT_STYLE[status] ?? PAYMENT_STYLE.pending;
  return (
    <span className={`${base} ${style.cls}`} data-testid="payment-status">
      {style.icon}
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const s = normalizeOrderStatus(status);
  const style = ORDER_STYLE[s] ?? ORDER_STYLE.pending;
  return (
    <span className={`${base} ${style.cls}`} data-testid="order-status">
      {style.icon}
      {ORDER_STATUS_LABEL[s] ?? s}
    </span>
  );
};

/** Two clearly separated, labelled status blocks: Payment and Order. */
export const OrderStatusPair: React.FC<{ orderStatus: OrderStatus; paymentStatus: PaymentStatus }> = ({
  orderStatus, paymentStatus,
}) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Payment</span>
      <PaymentStatusBadge status={paymentStatus} />
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Order</span>
      <OrderStatusBadge status={orderStatus} />
    </div>
  </div>
);
