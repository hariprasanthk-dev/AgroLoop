import React, { useEffect, useState, useCallback } from 'react';
import {
  Package, Search, CheckCircle2, XCircle, Truck,
  BoxIcon, Clock, TrendingUp, Users, Loader2,
  AlertCircle, ChevronDown,
} from 'lucide-react';
import { useOrderStore } from '../../stores/order.store';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import OrderActions from '../../components/orders/OrderActions';
import FarmerStatCard from '../../components/orders/FarmerStatCard';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';
import type { Order, OrderStatus } from '../../types';

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock className="w-4 h-4 text-amber-400" />,
  accepted:  <CheckCircle2 className="w-4 h-4 text-blue-400" />,
  packed:    <BoxIcon className="w-4 h-4 text-purple-400" />,
  shipped:   <Truck className="w-4 h-4 text-cyan-400" />,
  delivered: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  cancelled: <XCircle className="w-4 h-4 text-red-400" />,
};

// Local constants used by the detail modal's advance button
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

// ─── Main Component ───────────────────────────────────────────────────────────
const FarmerOrders: React.FC = () => {
  const { orders, isLoading, pagination, fetchOrders, acceptOrder, rejectOrder, updateOrderStatus, error } = useOrderStore();
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchOrders({ orderStatus: filterStatus || undefined, limit: 50 });
  }, [fetchOrders, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const client = typeof o.clientId === 'object' ? o.clientId : null;
    const batch = typeof o.inventoryBatchId === 'object' ? o.inventoryBatchId : null;
    return (
      o._id.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      (client?.name ?? '').toLowerCase().includes(q) ||
      (batch?.category ?? '').includes(q)
    );
  });

  const handleAccept = async (id: string) => {
    setBusyId(id);
    try { await acceptOrder(id); } catch {/**/}
    setBusyId(null);
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    try { await rejectOrder(id); setRejectConfirmId(null); } catch {/**/}
    setBusyId(null);
  };

  const handleAdvance = async (id: string, status: OrderStatus) => {
    setBusyId(id);
    try { await updateOrderStatus(id, status); } catch {/**/}
    setBusyId(null);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const pending   = orders.filter((o) => o.orderStatus === 'pending').length;
  const active    = orders.filter((o) => ['accepted', 'packed', 'shipped'].includes(o.orderStatus)).length;
  const delivered = orders.filter((o) => o.orderStatus === 'delivered').length;
  const revenue   = orders
    .filter((o) => o.orderStatus === 'delivered')
    .reduce((s, o) => s + o.totalAmount, 0);
  const totalOrders = pagination?.total ?? orders.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Order Management</h1>
          <p className="page-subtitle">
            {totalOrders} total order{totalOrders !== 1 ? 's' : ''} on your inventory
          </p>
        </div>
        {pending > 0 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-amber-300 text-sm font-medium">{pending} pending action{pending > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* ── Stats Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FarmerStatCard
          label="Pending" value={pending}
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          colorClass="text-amber-400" bgClass="bg-amber-500/10 border-amber-500/20"
        />
        <FarmerStatCard
          label="In Progress" value={active}
          icon={<Truck className="w-4 h-4 text-blue-400" />}
          colorClass="text-blue-400" bgClass="bg-blue-500/10 border-blue-500/20"
        />
        <FarmerStatCard
          label="Delivered" value={delivered}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          colorClass="text-emerald-400" bgClass="bg-emerald-500/10 border-emerald-500/20"
        />
        <FarmerStatCard
          label="Revenue (Delivered)" value={formatCurrency(revenue)}
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          colorClass="text-emerald-400" bgClass="bg-emerald-500/10 border-emerald-500/20"
        />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="farmer-order-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, category, destination…"
            className="input-field pl-10"
          />
        </div>
        <select
          id="farmer-status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="select-field w-44"
        >
          <option value="">All Statuses</option>
          {(['pending', 'accepted', 'packed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="glass-card p-4 border border-red-500/30 bg-red-500/10 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* ── Order Cards ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="glass-card empty-state py-20">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-slate-400">No orders found</p>
              {filterStatus && (
                <button onClick={() => setFilterStatus('')} className="mt-3 btn-secondary text-xs">
                  Clear filter
                </button>
              )}
            </div>
          ) : filtered.map((order) => {
            const client = typeof order.clientId === 'object' ? order.clientId : null;
            const batch  = typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;

            return (
              <div
                key={order._id}
                className={`glass-card p-5 transition-all duration-200 hover:border-slate-600/70 ${
                  order.orderStatus === 'pending' ? 'border-amber-500/30 bg-amber-500/3' : ''
                }`}
              >
                {/* ── Order Header ───────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl">
                      {getCategoryIcon(batch?.category ?? 'fresh')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-200 capitalize">
                          {batch?.category ?? 'Onion'} Onions
                        </p>
                        {order.orderStatus === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono">#{order._id.slice(-10)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {STATUS_ICON[order.orderStatus]}
                    <Badge label={order.orderStatus} />
                    <Badge label={order.paymentStatus} />
                  </div>
                </div>

                {/* ── Details Grid ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                      <Users className="w-3 h-3" /> Client
                    </p>
                    <p className="font-semibold text-slate-200 truncate">{client?.name ?? '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{client?.email ?? ''}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Quantity</p>
                    <p className="font-semibold text-slate-200">{formatWeight(order.quantityKg)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Amount</p>
                    <p className="font-semibold text-emerald-400">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Destination</p>
                    <p className="font-semibold text-slate-200 truncate">{order.destination}</p>
                  </div>
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-700/40">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
                    <button
                      id={`farmer-view-${order._id}`}
                      onClick={() => setSelectedOrder(order)}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-2"
                    >
                      View Details
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <OrderActions
                      order={order}
                      onAccept={handleAccept}
                      onReject={(id) => setRejectConfirmId(id)}
                      onAdvance={handleAdvance}
                      busyId={busyId}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════ DETAIL MODAL ════════════════════════════════════════════════════ */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Order Details" size="lg">
        {selectedOrder && (() => {
          const client = typeof selectedOrder.clientId === 'object' ? selectedOrder.clientId : null;
          const batch  = typeof selectedOrder.inventoryBatchId === 'object' ? selectedOrder.inventoryBatchId : null;
          const next   = NEXT_STATUS[selectedOrder.orderStatus];
          return (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-700/30 border border-slate-600/30">
                <span className="text-5xl">{getCategoryIcon(batch?.category ?? 'fresh')}</span>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-100 capitalize">{batch?.category ?? 'Onion'} Onions</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">#{selectedOrder._id}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge label={selectedOrder.orderStatus} />
                    <Badge label={selectedOrder.paymentStatus} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Client Name', value: client?.name ?? '—', icon: '👤' },
                  { label: 'Client Email', value: client?.email ?? '—', icon: '📧' },
                  { label: 'Quantity', value: formatWeight(selectedOrder.quantityKg), icon: '📦' },
                  { label: 'Total Amount', value: formatCurrency(selectedOrder.totalAmount), icon: '💰' },
                  { label: 'Destination', value: selectedOrder.destination, icon: '📍' },
                  { label: 'Ordered On', value: formatDate(selectedOrder.createdAt), icon: '📅' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/20">
                    <p className="text-xs text-slate-500 mb-1">{icon} {label}</p>
                    <p className="font-semibold text-slate-200 text-sm break-all">{value}</p>
                  </div>
                ))}
              </div>

              {selectedOrder.notes && (
                <div className="p-4 rounded-xl bg-slate-700/20">
                  <p className="text-xs text-slate-500 mb-2">📝 Client Notes</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setSelectedOrder(null)} className="btn-secondary">Close</button>
                {selectedOrder.orderStatus === 'pending' && (
                  <>
                    <button
                      onClick={() => { setSelectedOrder(null); setRejectConfirmId(selectedOrder._id); }}
                      className="btn-secondary gap-2 text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button
                      onClick={() => { handleAccept(selectedOrder._id); setSelectedOrder(null); }}
                      className="btn-primary gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Accept
                    </button>
                  </>
                )}
                {next && selectedOrder.orderStatus !== 'pending' && (
                  <button
                    onClick={() => { handleAdvance(selectedOrder._id, next); setSelectedOrder(null); }}
                    className="btn-primary gap-2"
                  >
                    <ChevronDown className="w-4 h-4" />
                    {NEXT_STATUS_LABEL[selectedOrder.orderStatus]}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══════ REJECT CONFIRM MODAL ════════════════════════════════════════════ */}
      <Modal
        isOpen={!!rejectConfirmId}
        onClose={() => setRejectConfirmId(null)}
        title="Reject Order"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200 text-sm">Reject this order?</p>
              <p className="text-slate-400 text-xs mt-1">
                The stock will be restored and the client will be notified.
                This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRejectConfirmId(null)} className="btn-secondary" disabled={!!busyId}>
              Keep it
            </button>
            <button
              id={`confirm-reject-${rejectConfirmId}`}
              onClick={() => rejectConfirmId && handleReject(rejectConfirmId)}
              disabled={!!busyId}
              className="btn-primary bg-red-600 hover:bg-red-500 border-red-500/50 gap-2"
            >
              {busyId ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {busyId ? 'Rejecting…' : 'Yes, Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FarmerOrders;
