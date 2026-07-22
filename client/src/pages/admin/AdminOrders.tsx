import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useOrderStore } from '../../stores/order.store';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import { formatCurrency, formatDate, formatWeight } from '../../utils/helpers';
import type { Order, OrderStatus } from '../../types';

const statusFlow: OrderStatus[] = ['pending','accepted','packed','shipped','delivered','cancelled'];

const AdminOrders: React.FC = () => {
  const { orders, isLoading, fetchOrders, updateOrderStatus } = useOrderStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrders({ orderStatus: filterStatus || undefined });
  }, [fetchOrders, filterStatus]);

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setUpdating(true);
    await updateOrderStatus(id, status);
    setUpdating(false);
    setSelected(null);
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
          {statusFlow.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
                        <button onClick={() => setSelected(order)} className="btn-secondary !px-3 !py-1.5 text-xs">Update</button>
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
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Update Order Status" size="sm">
          <div className="mb-4">
            <p className="text-slate-400 text-sm">Order <span className="font-mono text-slate-300">#{selected._id.slice(-8)}</span></p>
            <p className="text-slate-400 text-sm mt-1">Current: <Badge label={selected.orderStatus} /></p>
          </div>
          <div className="space-y-2">
            {statusFlow.filter(s => s !== selected.orderStatus).map(s => (
              <button key={s} onClick={() => handleStatusChange(selected._id, s)} disabled={updating} className="w-full btn-secondary justify-start">
                <span className="capitalize">{s}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminOrders;
