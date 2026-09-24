import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Package, Search, CheckCircle2, XCircle, Truck, Clock, Users, Loader2,
  AlertCircle, AlertTriangle, RefreshCw, CreditCard, MapPin, CalendarDays, Scale, IndianRupee,
} from 'lucide-react';
import { useOrderStore } from '../../stores/order.store';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import OrderActions from '../../components/orders/OrderActions';
import OrderProgress from '../../components/orders/OrderProgress';
import FarmerStatCard from '../../components/orders/FarmerStatCard';
import { OrderStatusPair } from '../../components/orders/StatusBadges';
import { formatCurrency, formatDate, formatWeight } from '../../utils/helpers';
import {
  formatOrderRef, ORDER_STATUS_FILTERS, ORDER_STATUS_LABEL, needsManualRefund, normalizeOrderStatus,
} from '../../constants/orderStatus';
import type { Order, OrderStatus } from '../../types';

const CATEGORY_LABEL: Record<string, string> = {
  fresh: 'Fresh (Grade A) Onions',
  sprouted: 'Sprouted Onions',
  rotten: 'Processing-grade Onions',
};

const productName = (order: Order) => {
  const batch = typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;
  return batch ? CATEGORY_LABEL[batch.category] ?? `${batch.category} onions` : 'Batch no longer available';
};

const TRANSITION_SUCCESS: Partial<Record<OrderStatus, string>> = {
  accepted:  'Order accepted. The client has been notified.',
  packaged:  'Order marked as packaged.',
  shipped:   'Order marked as shipped.',
  delivered: 'Order marked as delivered.',
  cancelled: 'Order cancelled. The client has been notified.',
};

/** Blocks a stale double-click from hitting the *next* action that renders in the same place. */
const POST_ACTION_LOCK_MS = 800;

const FarmerOrders: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();
  const {
    orders, isLoading, pagination, error, fetchOrders, refreshOrder,
    acceptOrder, rejectOrder, updateOrderStatus,
  } = useOrderStore();

  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [confirmCancel, setConfirmCancel] = useState<Order | null>(null);
  const [deepLinkLoading, setDeepLinkLoading] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(() => {
    fetchOrders({ orderStatus: filterStatus || undefined, limit: 50 }).then(() => { hasLoaded.current = true; });
  }, [fetchOrders, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // ── Deep link: /farmer/orders/:orderId ──────────────────────────────────────
  const selectedOrder = orderId ? orders.find((o) => o._id === orderId) ?? null : null;

  useEffect(() => {
    if (!orderId || selectedOrder || isLoading || !hasLoaded.current) return;
    setDeepLinkLoading(true);
    refreshOrder(orderId).then((order) => {
      setDeepLinkLoading(false);
      if (!order) {
        toast.error('That order could not be found or you do not have access to it.');
        navigate('/farmer/orders', { replace: true });
      }
    });
  }, [orderId, selectedOrder, isLoading, refreshOrder, navigate]);

  const openOrder = (id: string) => navigate(`/farmer/orders/${id}`);
  const closeOrder = () => navigate('/farmer/orders');

  // ── Actions ────────────────────────────────────────────────────────────────
  const setBusy = (id: string, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const run = async (id: string, to: OrderStatus, action: () => Promise<Order>) => {
    if (busyIds.has(id)) return; // prevent duplicate submissions
    setBusy(id, true);
    let ok = false;
    try {
      await action();
      ok = true;
      toast.success(TRANSITION_SUCCESS[to] ?? 'Order updated.');
    } catch (err) {
      toast.error((err as Error).message);
      // Our view may be stale (e.g. payment state changed) — re-read the truth.
      refreshOrder(id);
    } finally {
      if (ok) setTimeout(() => setBusy(id, false), POST_ACTION_LOCK_MS);
      else setBusy(id, false);
    }
    return ok;
  };

  const handleAccept = (id: string) => run(id, 'accepted', () => acceptOrder(id));
  const handleAdvance = (id: string, status: OrderStatus) => run(id, status, () => updateOrderStatus(id, status));

  const handleConfirmCancel = async () => {
    if (!confirmCancel) return;
    const order = confirmCancel;
    const ok = await run(order._id, 'cancelled', () =>
      normalizeOrderStatus(order.orderStatus) === 'pending'
        ? rejectOrder(order._id)
        : updateOrderStatus(order._id, 'cancelled')
    );
    if (ok) setConfirmCancel(null); // keep the dialog open on failure
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const client = typeof o.clientId === 'object' ? o.clientId : null;
    return (
      formatOrderRef(o._id).toLowerCase().includes(q) ||
      o._id.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      (client?.name ?? '').toLowerCase().includes(q) ||
      productName(o).toLowerCase().includes(q)
    );
  });

  const awaitingPayment = orders.filter((o) => o.orderStatus === 'pending' && o.paymentStatus !== 'paid').length;
  const readyToAccept   = orders.filter((o) => o.orderStatus === 'pending' && o.paymentStatus === 'paid').length;
  const inProgress      = orders.filter((o) => ['accepted', 'packaged', 'shipped'].includes(normalizeOrderStatus(o.orderStatus))).length;
  const delivered       = orders.filter((o) => o.orderStatus === 'delivered').length;
  const totalOrders     = pagination?.total ?? orders.length;
  const showInitialSpinner = isLoading && orders.length === 0;

  const renderPaymentNote = (order: Order) => {
    if (needsManualRefund(order)) {
      return (
        <p className="text-xs text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Paid but cancelled — refunds are not automated; arrange it with the client.
        </p>
      );
    }
    return null;
  };

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
        {readyToAccept > 0 && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-sm font-medium">
              {readyToAccept} paid order{readyToAccept > 1 ? 's' : ''} ready to accept
            </span>
          </div>
        )}
      </div>

      {/* ── Stats Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FarmerStatCard label="Awaiting Payment" value={awaitingPayment}
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          colorClass="text-amber-400" bgClass="bg-amber-500/10 border-amber-500/20" />
        <FarmerStatCard label="Paid · Ready to Accept" value={readyToAccept}
          icon={<CreditCard className="w-4 h-4 text-emerald-400" />}
          colorClass="text-emerald-400" bgClass="bg-emerald-500/10 border-emerald-500/20" />
        <FarmerStatCard label="In Progress" value={inProgress}
          icon={<Truck className="w-4 h-4 text-blue-400" />}
          colorClass="text-blue-400" bgClass="bg-blue-500/10 border-blue-500/20" />
        <FarmerStatCard label="Delivered" value={delivered}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          colorClass="text-emerald-400" bgClass="bg-emerald-500/10 border-emerald-500/20" />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="farmer-order-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, client, product, destination…"
            className="input-field pl-10"
            aria-label="Search orders"
          />
        </div>
        <select
          id="farmer-status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="select-field w-44"
          aria-label="Filter by order status"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="glass-card p-4 border border-red-500/30 bg-red-500/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
          <button onClick={load} className="btn-secondary text-xs py-1.5 px-3 shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* ── Order Cards ─────────────────────────────────────────────────────── */}
      {showInitialSpinner ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="glass-card empty-state py-20">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-slate-400">{search || filterStatus ? 'No orders match your filters' : 'No orders yet'}</p>
              {(filterStatus || search) && (
                <button onClick={() => { setFilterStatus(''); setSearch(''); }} className="mt-3 btn-secondary text-xs">
                  Clear filters
                </button>
              )}
            </div>
          ) : filtered.map((order) => {
            const client = typeof order.clientId === 'object' ? order.clientId : null;
            const actionable = order.orderStatus === 'pending' && order.paymentStatus === 'paid';

            return (
              <article
                key={order._id}
                data-testid={`farmer-order-${order._id}`}
                className={`glass-card p-5 transition-all duration-200 hover:border-slate-600/70 ${
                  actionable ? 'border-emerald-500/30' : ''
                }`}
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 font-mono tracking-tight">Order {formatOrderRef(order._id)}</p>
                      <p className="text-sm text-slate-400 truncate">{productName(order)}</p>
                    </div>
                  </div>
                  <OrderStatusPair orderStatus={order.orderStatus} paymentStatus={order.paymentStatus} />
                </div>

                {/* Details */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <dt className="text-slate-500 text-xs flex items-center gap-1"><Scale className="w-3 h-3" /> Quantity</dt>
                    <dd className="font-semibold text-slate-200">{formatWeight(order.quantityKg)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Amount</dt>
                    <dd className="font-semibold text-emerald-400">{formatCurrency(order.totalAmount)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500 text-xs flex items-center gap-1"><Users className="w-3 h-3" /> Client</dt>
                    <dd className="font-semibold text-slate-200 truncate">{client?.name ?? '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Destination</dt>
                    <dd className="font-semibold text-slate-200 truncate">{order.destination}</dd>
                  </div>
                </dl>

                {renderPaymentNote(order)}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-700/40">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
                    <button
                      id={`farmer-view-${order._id}`}
                      onClick={() => openOrder(order._id)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      View Details
                    </button>
                  </div>
                  <OrderActions
                    order={order}
                    onAccept={handleAccept}
                    onCancel={setConfirmCancel}
                    onAdvance={handleAdvance}
                    busy={busyIds.has(order._id)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ══════ DETAIL MODAL (deep-linkable) ═══════════════════════════════════ */}
      <Modal isOpen={!!orderId} onClose={closeOrder} title={selectedOrder ? `Order ${formatOrderRef(selectedOrder._id)}` : 'Order Details'} size="lg">
        {!selectedOrder ? (
          <LoadingSpinner className="py-12" size="md" />
        ) : (() => {
          const client = typeof selectedOrder.clientId === 'object' ? selectedOrder.clientId : null;
          return (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-700/30 border border-slate-600/30 space-y-3">
                <p className="text-lg font-bold text-slate-100">{productName(selectedOrder)}</p>
                <OrderStatusPair orderStatus={selectedOrder.orderStatus} paymentStatus={selectedOrder.paymentStatus} />
                {renderPaymentNote(selectedOrder)}
              </div>

              <div className="p-4 rounded-xl bg-slate-700/20">
                <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">Progress</p>
                <OrderProgress order={selectedOrder} showTimestamps />
              </div>

              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Client', value: client?.name ?? '—', icon: <Users className="w-3.5 h-3.5" /> },
                  { label: 'Client Email', value: client?.email ?? '—', icon: <Users className="w-3.5 h-3.5" /> },
                  { label: 'Quantity', value: formatWeight(selectedOrder.quantityKg), icon: <Scale className="w-3.5 h-3.5" /> },
                  { label: 'Amount', value: formatCurrency(selectedOrder.totalAmount), icon: <IndianRupee className="w-3.5 h-3.5" /> },
                  { label: 'Destination', value: selectedOrder.destination, icon: <MapPin className="w-3.5 h-3.5" /> },
                  { label: 'Ordered On', value: formatDate(selectedOrder.createdAt), icon: <CalendarDays className="w-3.5 h-3.5" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/20">
                    <dt className="text-xs text-slate-500 mb-1 flex items-center gap-1">{icon} {label}</dt>
                    <dd className="font-semibold text-slate-200 text-sm break-all">{value}</dd>
                  </div>
                ))}
              </dl>

              {selectedOrder.notes && (
                <div className="p-4 rounded-xl bg-slate-700/20">
                  <p className="text-xs text-slate-500 mb-2">Client Notes</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
                <button onClick={closeOrder} className="btn-secondary">Close</button>
                <OrderActions
                  order={selectedOrder}
                  onAccept={handleAccept}
                  onCancel={setConfirmCancel}
                  onAdvance={handleAdvance}
                  busy={busyIds.has(selectedOrder._id)}
                />
              </div>
            </div>
          );
        })()}
        {deepLinkLoading && <span className="sr-only">Loading order</span>}
      </Modal>

      {/* ══════ REJECT / CANCEL CONFIRM ═════════════════════════════════════════ */}
      <Modal
        isOpen={!!confirmCancel}
        onClose={() => { if (!confirmCancel || !busyIds.has(confirmCancel._id)) setConfirmCancel(null); }}
        title={confirmCancel && normalizeOrderStatus(confirmCancel.orderStatus) === 'pending' ? 'Reject Order' : 'Cancel Order'}
        size="sm"
      >
        {confirmCancel && (() => {
          const status = normalizeOrderStatus(confirmCancel.orderStatus);
          const busy = busyIds.has(confirmCancel._id);
          return (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-400 space-y-1.5">
                  <p className="font-semibold text-slate-200 text-sm">
                    {status === 'pending' ? 'Reject' : 'Cancel'} order {formatOrderRef(confirmCancel._id)}?
                  </p>
                  <p>
                    {status === 'shipped'
                      ? 'The goods have already shipped, so the quantity will NOT be returned to your stock.'
                      : `${formatWeight(confirmCancel.quantityKg)} will be returned to your available stock.`}{' '}
                    The client will be notified. This cannot be undone.
                  </p>
                  {confirmCancel.paymentStatus === 'paid' && (
                    <p className="text-amber-300">
                      This order is paid. Refunds are not automated — you will need to arrange the refund with the client.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmCancel(null)} className="btn-secondary" disabled={busy}>
                  Keep order
                </button>
                <button
                  id={`confirm-cancel-${confirmCancel._id}`}
                  onClick={handleConfirmCancel}
                  disabled={busy}
                  className="btn-primary bg-red-600 hover:bg-red-500 border-red-500/50 gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {busy ? 'Working…' : status === 'pending' ? 'Yes, reject' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default FarmerOrders;
