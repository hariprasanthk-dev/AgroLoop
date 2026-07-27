import React from 'react';
import {
  Clock, CheckCircle2, Truck, Package, BoxIcon, XCircle,
} from 'lucide-react';
import type { OrderStatus } from '../../types';

// ─── Order Status Pipeline ────────────────────────────────────────────────────
const PIPELINE: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'pending',   label: 'Pending',   icon: <Clock className="w-3.5 h-3.5" /> },
  { key: 'accepted',  label: 'Accepted',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: 'packed',    label: 'Packed',    icon: <BoxIcon className="w-3.5 h-3.5" /> },
  { key: 'shipped',   label: 'Shipped',   icon: <Truck className="w-3.5 h-3.5" /> },
  { key: 'delivered', label: 'Delivered', icon: <Package className="w-3.5 h-3.5" /> },
];

interface OrderProgressProps {
  status: OrderStatus;
}

/**
 * Renders a horizontal step-progress bar for an order's fulfillment status.
 * Displays a cancelled state when status is 'cancelled'.
 */
const OrderProgress: React.FC<OrderProgressProps> = ({ status }) => {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 py-2">
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-sm text-red-400 font-medium">Order Cancelled</span>
      </div>
    );
  }

  const currentIdx = PIPELINE.findIndex((s) => s.key === status);

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {PIPELINE.map((step, i) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                  i < currentIdx
                    ? 'bg-emerald-500 text-white'
                    : i === currentIdx
                    ? 'bg-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-slate-700/60 text-slate-500'
                }`}
              >
                {step.icon}
              </div>
            </div>
            {i < PIPELINE.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 transition-all duration-300 ${
                  i < currentIdx ? 'bg-emerald-500' : 'bg-slate-700/60'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between">
        {PIPELINE.map((step) => (
          <span
            key={step.key}
            className={`text-[9px] font-medium capitalize ${
              step.key === status ? 'text-blue-400' : 'text-slate-600'
            }`}
            style={{ width: `${100 / PIPELINE.length}%`, textAlign: 'center' }}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default OrderProgress;
