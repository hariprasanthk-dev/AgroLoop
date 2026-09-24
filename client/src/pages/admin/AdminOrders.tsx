import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useOrderStore } from '../../stores/order.store';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import { formatCurrency, formatDate, formatWeight } from '../../utils/helpers';
import type { Order } from '../../types';
import { toast } from 'sonner';
import { CANCELLABLE_BY_FARMER, ORDER_STATUS_FILTERS, ORDER_STATUS_LABEL, formatOrderRef, normalizeOrderStatus } from '../../constants/orderStatus';
import { OrderStatusPair } from '../../components/orders/StatusBadges';

const AdminOrders: React.FC = () => {
  const { orders, isLoading, fetchOrders, updateOrderStatus } = useOrderStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrders({ orderStatus: filterStatus || undefined });
  }, [fetchOrders, filterStatus]);

  // Admins can cancel an order; fulfilment steps belong to the farmer and are
  // enforced by the server's order state machine.
  const handleCancel = async (id: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      await updateOrderStatus(id, 'cancelled');
      toast.success(`Order ${formatOrderRef(id)} cancelled`);
      setSelected(null);
    } catch (err) {
      toast.error('Could not cancel the order', { description: (err as Error).message });
    } finally {
      setUpdating(false);
    }
  };

  const filtered = orders.filter(o => {
    if (!search) return true;
    const client = typeof o.clientId === 'object' ? o.clientId.name : '';
    return client.toLowerCase().includes(search.toLowerCase()) || o._id.includes(search);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Order Management</h1>
          <p className="page-subtitle">Approve and track all orders</p>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by client or order ID…" className="input-field pl-10" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field w-44">
          <option value="">All Statuses</option>
          {ORDER_STATUS_FILTERS.map(s => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? <LoadingSpinner className="py-20" /> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Order ID</th><th>Client</th><th>Batch</th><th>Qty</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-16 text-slate-500">No orders found</td></tr>
                ) : filtered.map(order => {
                  const client = typeof order.clientId === 'object' ? order.clientId : null;
                  const batch  = typeof order.inventoryBatchId === 'object' ? order.inventoryBatchId : null;
                  return (
                    <tr key={order._id}>
                      <td className="font-mono text-xs text-slate-400">#{order._id.slice(-8)}</td>
                      <td>
                        <p className="font-medium text-slate-200">{client?.name ?? '—'}</p>
                        <p className="text-xs text-slate-500">{client?.email}</p>
                      </td>
                      <td>{batch ? <Badge label={batch.category} type="category" /> : <span className="text-slate-500">—</span>}</td>
                      <td className="text-slate-300">{formatWeight(order.quantityKg)}</td>
                      <td className="font-semibold text-slate-200">{formatCurrency(order.totalAmount)}</td>
                      <td><Badge label={order.paymentStatus} /></td>
                      <td><Badge label={order.orderStatus} /></td>
                      <td className="text-slate-400">{formatDate(order.createdAt)}</td>
                      <td>
                        <button onClick={() => setSelected(order)} className="btn-secondary !px-3 !py-1.5 text-xs">Manage</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal isOpen={!!selected} onClose={() => { if (!updating) setSelected(null); }} title={`Order ${formatOrderRef(selected._id)}`} size="sm">
          <div className="space-y-4">
            <OrderStatusPair orderStatus={selected.orderStatus} paymentStatus={selected.paymentStatus} />
            <p className="text-slate-400 text-xs">
              Accepting, packaging, shipping and delivery are performed by the farmer.
              Admins can cancel an order that has not been delivered.
            </p>
            {selected.paymentStatus === 'paid' && (
              <p className="text-amber-300 text-xs">This order is paid — refunds are not automated and must be arranged manually.</p>
            )}
            {CANCELLABLE_BY_FARMER.includes(normalizeOrderStatus(selected.orderStatus)) ? (
              <button onClick={() => handleCancel(selected._id)} disabled={updating} className="w-full btn-danger border justify-center">
                {updating ? 'Cancelling…' : 'Cancel order'}
              </button>
            ) : (
              <p className="text-slate-500 text-sm">No admin actions are available for a {ORDER_STATUS_LABEL[normalizeOrderStatus(selected.orderStatus)].toLowerCase()} order.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminOrders;
