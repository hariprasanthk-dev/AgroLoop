import React, { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart, Search, X, ChevronRight,
  MapPin, Clock, AlertCircle, CheckCircle2, Truck,
  BoxIcon, XCircle, Loader2, CreditCard,
} from 'lucide-react';
import { useOrderStore } from '../../stores/order.store';
import { usePaymentStore } from '../../stores/payment.store';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import OrderProgress from '../../components/orders/OrderProgress';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';
import type { Order, OrderStatus } from '../../types';

// ─── Status icon map (used in order card header) ──────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:   <Clock className="w-4 h-4 text-amber-400" />,
  accepted:  <CheckCircle2 className="w-4 h-4 text-blue-400" />,
  packed:    <BoxIcon className="w-4 h-4 text-purple-400" />,
  shipped:   <Truck className="w-4 h-4 text-cyan-400" />,
  delivered: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  cancelled: <XCircle className="w-4 h-4 text-red-400" />,
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ClientOrders: React.FC = () => {
  const { orders, isLoading, pagination, fetchOrders, cancelOrder } = useOrderStore();
  const { initiatePayment, verifyPayment, recordFailure } = usePaymentStore();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const handlePay = async (order: Order) => {
    setPayingId(order._id);
    try {
      const initData = await initiatePayment(order._id);
      
      const options = {
        key: initData.key,
        amount: initData.amount,
        currency: initData.currency,
        name: 'AgroLoop',
        description: `Order #${order._id.slice(-6)}`,
        order_id: initData.razorpayOrderId,
        handler: async (response: any) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            fetchOrders({ orderStatus: filterStatus || undefined, limit: 50 });
          } catch (err: any) {
            console.error('Payment verification failed:', err);
          } finally {
            setPayingId(null);
          }
        },
        modal: {
          ondismiss: () => {
            recordFailure(initData.razorpayOrderId, 'User closed the payment window');
            setPayingId(null);
          },
        },
        prefill: {
          name: '',
          email: '',
        },
        theme: {
          color: '#10B981',
        },
      };

      const rz = new (window as any).Razorpay(options);
      rz.on('payment.failed', (resp: any) => {
        recordFailure(initData.razorpayOrderId, resp.error.description);
        setPayingId(null);
      });
      rz.open();
    } catch (err) {
      console.error('Initiating payment failed:', err);
      setPayingId(null);
    }
  };

  const load = useCallback(() => {
    fetchOrders({ orderStatus: filterStatus || undefined, limit: 50 });
  }, [fetchOrders, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const batch = typeof o.inventoryBatchId === 'object' ? o.inventoryBatchId : null;
    return (
      o._id.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      (batch?.category ?? '').includes(q)
    );
  });

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await cancelOrder(orderId);
      setConfirmCancelId(null);
    } catch {/* store has error */}
    setCancellingId(null);
  };

  const pendingCount  = orders.filter((o) => o.orderStatus === 'pending').length;
  const activeCount   = orders.filter((o) => !['cancelled', 'delivered'].includes(o.orderStatus)).length;
  const deliveredCount = orders.filter((o) => o.orderStatus === 'delivered').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Orders</h1>
          <p className="page-subtitle">
            {pagination ? `${pagination.total} total order${pagination.total !== 1 ? 's' : ''}` : 'Track your orders in real time'}
          </p>
        </div>
      </div>

      {/* ── Summary Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending',   value: pendingCount,   color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Active',    value: activeCount,    color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Delivered', value: deliveredCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`glass-card p-4 border text-center ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="order-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, destination, category…"
            className="input-field pl-10"
          />
        </div>
        <select
          id="order-status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="select-field w-44"
        >
          <option value="">All Statuses</option>
          {(['pending', 'accepted', 'packed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {search && (
          <button onClick={() => setSearch('')} className="btn-secondary gap-1 text-xs">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Order List ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="glass-card empty-state py-20">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-slate-400">No orders found</p>
              <a href="/client/browse" className="mt-3 btn-primary text-sm">Browse Inventory</a>
            </div>
          ) : filtered.map((order) => {
            const batch = typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;
            const isCancellable = order.orderStatus === 'pending';

            return (
              <div
                key={order._id}
                className="glass-card p-5 hover:border-slate-600/70 transition-all duration-200"
              >
                {/* ── Header row ──────────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl">
                      {getCategoryIcon(batch?.category ?? 'fresh')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-200 capitalize">
                        {batch?.category ?? 'Onion'} Onions
                      </p>
                      <p className="text-xs text-slate-500 font-mono">#{order._id.slice(-10)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICONS[order.orderStatus]}
                      <Badge label={order.orderStatus} />
                    </div>
                    <Badge label={order.paymentStatus} />
                  </div>
                </div>

                {/* ── Progress bar ─────────────────────────────────────────── */}
                <div className="mb-4">
                  <OrderProgress status={order.orderStatus} />
                </div>

                {/* ── Details grid ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-slate-500 text-xs">Quantity</p>
                    <p className="font-semibold text-slate-200">{formatWeight(order.quantityKg)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Total</p>
                    <p className="font-semibold text-emerald-400">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Destination</p>
                    <p className="font-semibold text-slate-200 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      {order.destination}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Ordered On</p>
                    <p className="font-semibold text-slate-200">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {/* ── Actions ──────────────────────────────────────────────── */}
                <div className="flex gap-2 pt-3 border-t border-slate-700/40">
                  <button
                    id={`view-order-${order._id}`}
                    onClick={() => setSelectedOrder(order)}
                    className="btn-secondary text-xs gap-1"
                  >
                    <ChevronRight className="w-3.5 h-3.5" /> View Details
                  </button>
                  {isCancellable && (
                    <button
                      id={`cancel-order-${order._id}`}
                      onClick={() => setConfirmCancelId(order._id)}
                      className="btn-secondary text-xs gap-1 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-400/40 hover:bg-red-500/10"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel Order
                    </button>
                  )}
                  {['accepted', 'packed', 'shipped', 'delivered'].includes(order.orderStatus) && order.paymentStatus === 'pending' && (
                    <button
                      id={`pay-order-${order._id}`}
                      onClick={() => handlePay(order)}
                      disabled={payingId === order._id}
                      className="btn-primary text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50"
                    >
                      {payingId === order._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5" />
                      )}
                      {payingId === order._id ? 'Processing...' : 'Pay Now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════ DETAIL MODAL ══════════════════════════════════════════════════ */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Order Details" size="lg">
        {selectedOrder && (() => {
          const batch = typeof selectedOrder.inventoryBatchId === 'object' ? selectedOrder.inventoryBatchId : null;
          return (
            <div className="space-y-5">
              {/* Hero */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-700/30 border border-slate-600/30">
                <span className="text-5xl">{getCategoryIcon(batch?.category ?? 'fresh')}</span>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-100 capitalize">
                    {batch?.category ?? 'Onion'} Onions
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">Order #{selectedOrder._id}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge label={selectedOrder.orderStatus} />
                    <Badge label={selectedOrder.paymentStatus} />
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="p-4 rounded-xl bg-slate-700/20">
                <p className="text-xs text-slate-500 mb-3">Order Progress</p>
                <OrderProgress status={selectedOrder.orderStatus} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Quantity', value: formatWeight(selectedOrder.quantityKg), icon: '📦' },
                  { label: 'Total Amount', value: formatCurrency(selectedOrder.totalAmount), icon: '💰' },
                  { label: 'Destination', value: selectedOrder.destination, icon: '📍' },
                  { label: 'Ordered On', value: formatDate(selectedOrder.createdAt), icon: '📅' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/20">
                    <p className="text-xs text-slate-500 mb-1">{icon} {label}</p>
                    <p className="font-semibold text-slate-200 text-sm truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="p-4 rounded-xl bg-slate-700/20 border border-slate-600/20">
                  <p className="text-xs text-slate-500 mb-2">📝 Notes</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                {selectedOrder.orderStatus === 'pending' && (
                  <button
                    id={`modal-cancel-${selectedOrder._id}`}
                    onClick={() => { setSelectedOrder(null); setConfirmCancelId(selectedOrder._id); }}
                    className="btn-secondary gap-2 text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10"
                  >
                    <XCircle className="w-4 h-4" /> Cancel Order
                  </button>
                )}
                {['accepted', 'packed', 'shipped', 'delivered'].includes(selectedOrder.orderStatus) && selectedOrder.paymentStatus === 'pending' && (
                  <button
                    id={`modal-pay-${selectedOrder._id}`}
                    onClick={() => { handlePay(selectedOrder); setSelectedOrder(null); }}
                    disabled={payingId === selectedOrder._id}
                    className="btn-primary gap-2 bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50"
                  >
                    {payingId === selectedOrder._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    {payingId === selectedOrder._id ? 'Processing...' : 'Pay Now'}
                  </button>
                )}
                <button onClick={() => setSelectedOrder(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══════ CONFIRM CANCEL MODAL ═══════════════════════════════════════════ */}
      <Modal
        isOpen={!!confirmCancelId}
        onClose={() => setConfirmCancelId(null)}
        title="Cancel Order"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200 text-sm">Are you sure?</p>
              <p className="text-slate-400 text-xs mt-1">
                Cancelling this order will restore the stock to the farmer's inventory.
                This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmCancelId(null)}
              className="btn-secondary"
              disabled={!!cancellingId}
            >
              Keep Order
            </button>
            <button
              id={`confirm-cancel-${confirmCancelId}`}
              onClick={() => confirmCancelId && handleCancel(confirmCancelId)}
              disabled={!!cancellingId}
              className="btn-primary bg-red-600 hover:bg-red-500 border-red-500/50 gap-2"
            >
              {cancellingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {cancellingId ? 'Cancelling…' : 'Yes, Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientOrders;
