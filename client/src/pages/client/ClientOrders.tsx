import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ShoppingCart, Search, X, ChevronRight, MapPin, AlertCircle, AlertTriangle,
  XCircle, Loader2, CreditCard, Package, RefreshCw, Clock,
} from 'lucide-react';
import { useOrderStore } from '../../stores/order.store';
import { usePaymentStore } from '../../stores/payment.store';
import { useAuthStore } from '../../stores/auth.store';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import OrderProgress from '../../components/orders/OrderProgress';
import { OrderStatusPair } from '../../components/orders/StatusBadges';
import { formatCurrency, formatDate, formatWeight } from '../../utils/helpers';
import { loadRazorpaySdk } from '../../utils/razorpay';
import {
  formatOrderRef, ORDER_STATUS_FILTERS, ORDER_STATUS_LABEL, canClientPay, needsManualRefund,
} from '../../constants/orderStatus';
import type { Order, RazorpayOptions } from '../../types';

const CATEGORY_LABEL: Record<string, string> = {
  fresh: 'Fresh (Grade A) Onions',
  sprouted: 'Sprouted Onions',
  rotten: 'Processing-grade Onions',
};

const productName = (order: Order) => {
  const batch = typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;
  return batch ? CATEGORY_LABEL[batch.category] ?? `${batch.category} onions` : 'Onion batch';
};

/** Explains the payment state in plain language for the client. */
const PaymentMessage: React.FC<{ order: Order }> = ({ order }) => {
  if (needsManualRefund(order)) {
    return (
      <p className="text-xs text-amber-300 flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        This order was cancelled after you paid. Refunds are not automatic — please contact the farmer to arrange yours.
      </p>
    );
  }
  if (order.orderStatus === 'cancelled') return null;
  if (order.paymentStatus === 'failed') {
    return (
      <p className="text-xs text-red-300 flex items-start gap-1.5" role="alert">
        <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Your last payment attempt failed. The farmer cannot accept this order until it is paid — please try again.
      </p>
    );
  }
  if (order.paymentStatus === 'pending') {
    return (
      <p className="text-xs text-amber-300 flex items-start gap-1.5">
        <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Payment pending. The farmer will review your order once it is paid.
      </p>
    );
  }
  if (order.orderStatus === 'pending') {
    return <p className="text-xs text-emerald-300">Payment received. Waiting for the farmer to accept your order.</p>;
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ClientOrders: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { orders, isLoading, pagination, error, fetchOrders, cancelOrder, refreshOrder } = useOrderStore();
  const { initiatePayment, verifyPayment, recordFailure } = usePaymentStore();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(() => {
    fetchOrders({ orderStatus: filterStatus || undefined, limit: 50 }).then(() => { hasLoaded.current = true; });
  }, [fetchOrders, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // ── Deep link: /client/orders/:orderId ──────────────────────────────────────
  const selectedOrder = orderId ? orders.find((o) => o._id === orderId) ?? null : null;

  useEffect(() => {
    if (!orderId || selectedOrder || isLoading || !hasLoaded.current) return;
    refreshOrder(orderId).then((order) => {
      if (!order) {
        toast.error('That order could not be found or you do not have access to it.');
        navigate('/client/orders', { replace: true });
      }
    });
  }, [orderId, selectedOrder, isLoading, refreshOrder, navigate]);

  const openOrder = (id: string) => navigate(`/client/orders/${id}`);
  const closeOrder = () => navigate('/client/orders');

  // ── Payment ────────────────────────────────────────────────────────────────
  const handlePay = async (order: Order) => {
    if (payingId) return; // one checkout at a time
    setPayingId(order._id);
    const ref = formatOrderRef(order._id);

    try {
      await loadRazorpaySdk();
      const initData = await initiatePayment(order._id);

      let settled = false;        // the success handler ran
      let failedAttempt = false;  // a failure was already reported to the user
      const options: RazorpayOptions = {
        key: initData.key,
        amount: initData.amount,
        currency: initData.currency,
        name: 'AgroLoop',
        description: `Order ${ref}`,
        order_id: initData.razorpayOrderId,
        handler: async (response) => {
          settled = true;
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful', {
              description: `Order ${ref} is paid. The farmer has been notified.`,
              id: `${order._id}:payment_success`,
            });
          } catch (err) {
            toast.error('We could not confirm your payment', {
              description: `${(err as Error).message} If money was deducted, contact support with payment ID ${response.razorpay_payment_id}.`,
              duration: 15000,
            });
          } finally {
            await refreshOrder(order._id); // show the status the server recorded
            setPayingId(null);
          }
        },
        modal: {
          ondismiss: () => {
            setPayingId(null);
            if (!settled && !failedAttempt) {
              // Closing the checkout is not a failed payment — the order stays payable.
              toast.info('Payment not completed', { description: `You can pay for order ${ref} any time from My Orders.` });
            }
          },
        },
        prefill: { name: user?.name ?? '', email: user?.email ?? '' },
        theme: { color: '#10B981' },
      };

      const rz = new window.Razorpay!(options);
      rz.on('payment.failed', async (resp) => {
        // Razorpay keeps the checkout open so the client can retry; record the
        // failed attempt so both parties see the real state.
        failedAttempt = true;
        toast.error('Payment failed', {
          description: `${resp.error.description || 'Your bank declined the payment.'} You can retry in the payment window.`,
        });
        try {
          await recordFailure(initData.razorpayOrderId, resp.error.description);
        } catch (err) {
          toast.error((err as Error).message);
        }
        await refreshOrder(order._id);
      });
      rz.open();
    } catch (err) {
      toast.error('Could not start payment', { description: (err as Error).message });
      setPayingId(null);
    }
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = async (id: string) => {
    if (cancellingId) return;
    setCancellingId(id);
    try {
      await cancelOrder(id);
      toast.success(`Order ${formatOrderRef(id)} cancelled`, { description: 'The reserved stock was released.' });
      setConfirmCancelId(null);
    } catch (err) {
      toast.error('Could not cancel the order', { description: (err as Error).message });
    } finally {
      setCancellingId(null);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      formatOrderRef(o._id).toLowerCase().includes(q) ||
      o._id.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      productName(o).toLowerCase().includes(q)
    );
  });

  const awaitingPayment = orders.filter((o) => canClientPay(o)).length;
  const activeCount     = orders.filter((o) => !['cancelled', 'delivered'].includes(o.orderStatus)).length;
  const deliveredCount  = orders.filter((o) => o.orderStatus === 'delivered').length;
  const showInitialSpinner = isLoading && orders.length === 0;

  const renderActions = (order: Order, inModal = false) => {
    const paying = payingId === order._id;
    const clientCancellable = order.orderStatus === 'pending' && order.paymentStatus !== 'paid';
    return (
      <>
        {!inModal && (
          <button id={`view-order-${order._id}`} onClick={() => openOrder(order._id)} className="btn-secondary text-xs gap-1">
            <ChevronRight className="w-3.5 h-3.5" /> View Details
          </button>
        )}
        {clientCancellable && (
          <button
            id={`cancel-order-${order._id}`}
            onClick={() => setConfirmCancelId(order._id)}
            disabled={paying}
            className="btn-secondary text-xs gap-1 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-400/40 hover:bg-red-500/10"
          >
            <XCircle className="w-3.5 h-3.5" /> Cancel Order
          </button>
        )}
        {canClientPay(order) && (
          <button
            id={`pay-order-${order._id}`}
            onClick={() => handlePay(order)}
            disabled={!!payingId}
            className="btn-primary text-xs gap-1.5"
          >
            {paying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            {paying ? 'Processing…' : order.paymentStatus === 'failed' ? 'Retry Payment' : 'Pay Now'}
          </button>
        )}
      </>
    );
  };

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
          { label: 'Awaiting Payment', value: awaitingPayment, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Active',           value: activeCount,     color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Delivered',        value: deliveredCount,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
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
            placeholder="Search by order #, destination, product…"
            className="input-field pl-10"
            aria-label="Search orders"
          />
        </div>
        <select
          id="order-status-filter"
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
        {search && (
          <button onClick={() => setSearch('')} className="btn-secondary gap-1 text-xs">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

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

      {/* ── Order List ───────────────────────────────────────────────────────── */}
      {showInitialSpinner ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="glass-card empty-state py-20">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-slate-400">{search || filterStatus ? 'No orders match your filters' : 'No orders yet'}</p>
              {!search && !filterStatus && (
                <Link to="/client/browse" className="mt-3 btn-primary text-sm">Browse Inventory</Link>
              )}
            </div>
          ) : filtered.map((order) => (
            <article key={order._id} data-testid={`client-order-${order._id}`} className="glass-card p-5 hover:border-slate-600/70 transition-all duration-200">
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

              {/* Progress */}
              <div className="mb-4">
                <OrderProgress order={order} />
              </div>

              {/* Details */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-3">
                <div>
                  <dt className="text-slate-500 text-xs">Quantity</dt>
                  <dd className="font-semibold text-slate-200">{formatWeight(order.quantityKg)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Total</dt>
                  <dd className="font-semibold text-emerald-400">{formatCurrency(order.totalAmount)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500 text-xs">Destination</dt>
                  <dd className="font-semibold text-slate-200 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                    {order.destination}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Ordered On</dt>
                  <dd className="font-semibold text-slate-200">{formatDate(order.createdAt)}</dd>
                </div>
              </dl>

              <PaymentMessage order={order} />

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-slate-700/40">
                {renderActions(order)}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ══════ DETAIL MODAL (deep-linkable) ══════════════════════════════════ */}
      <Modal isOpen={!!orderId} onClose={closeOrder} title={selectedOrder ? `Order ${formatOrderRef(selectedOrder._id)}` : 'Order Details'} size="lg">
        {!selectedOrder ? (
          <LoadingSpinner className="py-12" size="md" />
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-700/30 border border-slate-600/30 space-y-3">
              <p className="text-lg font-bold text-slate-100">{productName(selectedOrder)}</p>
              <OrderStatusPair orderStatus={selectedOrder.orderStatus} paymentStatus={selectedOrder.paymentStatus} />
              <PaymentMessage order={selectedOrder} />
            </div>

            <div className="p-4 rounded-xl bg-slate-700/20">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">Order Progress</p>
              <OrderProgress order={selectedOrder} showTimestamps />
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {[
                { label: 'Quantity', value: formatWeight(selectedOrder.quantityKg) },
                { label: 'Total Amount', value: formatCurrency(selectedOrder.totalAmount) },
                { label: 'Destination', value: selectedOrder.destination },
                { label: 'Ordered On', value: formatDate(selectedOrder.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/20">
                  <dt className="text-xs text-slate-500 mb-1">{label}</dt>
                  <dd className="font-semibold text-slate-200 text-sm break-words">{value}</dd>
                </div>
              ))}
            </dl>

            {selectedOrder.notes && (
              <div className="p-4 rounded-xl bg-slate-700/20 border border-slate-600/20">
                <p className="text-xs text-slate-500 mb-2">Notes</p>
                <p className="text-slate-300 text-sm leading-relaxed">{selectedOrder.notes}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button onClick={closeOrder} className="btn-secondary">Close</button>
              {renderActions(selectedOrder, true)}
            </div>
          </div>
        )}
      </Modal>

      {/* ══════ CONFIRM CANCEL MODAL ═══════════════════════════════════════════ */}
      <Modal
        isOpen={!!confirmCancelId}
        onClose={() => { if (!cancellingId) setConfirmCancelId(null); }}
        title="Cancel Order"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200 text-sm">
                Cancel order {confirmCancelId ? formatOrderRef(confirmCancelId) : ''}?
              </p>
              <p className="text-slate-400 text-xs mt-1">
                The reserved stock will be released back to the farmer. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmCancelId(null)} className="btn-secondary" disabled={!!cancellingId}>
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
