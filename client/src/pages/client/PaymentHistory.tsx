import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Search, Calendar, BadgeAlert,
  TrendingUp, Clock, CheckCircle2,
} from 'lucide-react';
import { usePaymentStore } from '../../stores/payment.store';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';
import type { Order } from '../../types';

const PaymentHistory: React.FC = () => {
  const { payments, isLoading, pagination, fetchPayments } = usePaymentStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(() => {
    fetchPayments({ status: filterStatus || undefined, limit: 50 });
  }, [fetchPayments, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = payments.filter((p) => {
    const order = typeof p.orderId === 'object' ? (p.orderId as Order) : null;
    const client = order && typeof order.clientId === 'object' ? order.clientId : null;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p._id.toLowerCase().includes(q) ||
      (p.paymentId ?? '').toLowerCase().includes(q) ||
      (p.razorpayOrderId ?? '').toLowerCase().includes(q) ||
      (order?._id ?? '').toLowerCase().includes(q) ||
      (client?.name ?? '').toLowerCase().includes(q)
    );
  });

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + p.amount, 0);

  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const successCount = payments.filter((p) => p.status === 'paid').length;
  const failedCount = payments.filter((p) => p.status === 'failed').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment History</h1>
          <p className="page-subtitle">
            {pagination ? `${pagination.total} payment transactions` : 'Track payment history and invoices'}
          </p>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-500/10 text-center">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Total Paid</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
        </div>

        <div className="glass-card p-4 border border-blue-500/20 bg-blue-500/10 text-center">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Successful</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">{successCount}</p>
        </div>

        <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/10 text-center">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Pending</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
        </div>

        <div className="glass-card p-4 border border-red-500/20 bg-red-500/10 text-center">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium">Failed</span>
            <BadgeAlert className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">{failedCount}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="payment-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Payment ID, Order ID, Client Name..."
            className="input-field pl-10"
          />
        </div>
        <select
          id="payment-status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="select-field w-44"
        >
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Payment Table */}
      {isLoading ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : (
        <div className="glass-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="empty-state py-20 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20 text-slate-400" />
              <p className="text-slate-400">No payment history found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/30 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Order details</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Payment Method</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30 text-sm text-slate-300">
                  {filtered.map((payment) => {
                    const order = typeof payment.orderId === 'object' ? (payment.orderId as Order) : null;
                    const batch = order && typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;

                    return (
                      <tr
                        key={payment._id}
                        className="hover:bg-slate-700/10 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-xs">
                          {payment.paymentId ? (
                            <span className="text-slate-200">{payment.paymentId}</span>
                          ) : (
                            <span className="text-slate-500 font-sans italic">Not available</span>
                          )}
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Order ID: #{order?._id.slice(-8) ?? 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {order ? (
                            <div>
                              <div className="font-semibold text-slate-200 capitalize">
                                {getCategoryIcon(batch?.category ?? 'fresh')} {batch?.category ?? 'Onion'} Onions
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {formatWeight(order.quantityKg)} · {order.destination}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Order details missing</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-400">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 capitalize text-xs">
                          {payment.paymentMethod}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {formatDate(payment.paidAt || payment.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge label={payment.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
