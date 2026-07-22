import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, Search } from 'lucide-react';
import { useInventoryStore } from '../../stores/inventory.store';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';
import type { InventoryBatch, OnionCategory, BatchStatus } from '../../types';
import { useForm } from 'react-hook-form';

interface EditForm {
  category: OnionCategory;
  quantityKg: number;
  pricePerKg: number;
  status: BatchStatus;
  description?: string;
}

const AdminInventory: React.FC = () => {
  const { batches, isLoading, fetchBatches, updateBatch, deleteBatch } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editBatch, setEditBatch] = useState<InventoryBatch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<EditForm>();

  useEffect(() => {
    fetchBatches({ category: filterCat || undefined, status: filterStatus || undefined });
  }, [fetchBatches, filterCat, filterStatus]);

  const openEdit = (batch: InventoryBatch) => {
    setEditBatch(batch);
    reset({ category: batch.category, quantityKg: batch.quantityKg, pricePerKg: batch.pricePerKg, status: batch.status, description: batch.description });
  };

  const onUpdate = async (data: EditForm) => {
    if (!editBatch) return;
    await updateBatch(editBatch._id, data);
    setEditBatch(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteBatch(deleteId);
    setDeleteId(null);
  };

  const filtered = batches.filter(b => {
    const farmer = typeof b.farmerId === 'object' ? b.farmerId.name : '';
    return !search || farmer.toLowerCase().includes(search.toLowerCase()) || b.category.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-subtitle">View and manage all onion batches</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batches…" className="input-field pl-10" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="select-field w-40">
          <option value="">All Categories</option>
          <option value="fresh">🧅 Fresh</option>
          <option value="sprouted">🌱 Sprouted</option>
          <option value="rotten">♻️ Rotten</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field w-40">
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? <LoadingSpinner className="py-20" /> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Category</th><th>Farmer</th><th>Quantity</th><th>Price/kg</th><th>Status</th><th>Intake Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-slate-500">No inventory batches found</td></tr>
                ) : filtered.map(batch => {
                  const farmer = typeof batch.farmerId === 'object' ? batch.farmerId : null;
                  return (
                    <tr key={batch._id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCategoryIcon(batch.category)}</span>
                          <Badge label={batch.category} type="category" />
                        </div>
                      </td>
                      <td>
                        <p className="font-medium text-slate-200">{farmer?.name ?? '—'}</p>
                        <p className="text-xs text-slate-500">{farmer?.email}</p>
                      </td>
                      <td className="font-semibold text-slate-200">{formatWeight(batch.quantityKg)}</td>
                      <td className="text-slate-300">{formatCurrency(batch.pricePerKg)}/kg</td>
                      <td><Badge label={batch.status} /></td>
                      <td className="text-slate-400">{formatDate(batch.intakeDate)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(batch)} className="btn-secondary !px-3 !py-1.5 text-xs">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => setDeleteId(batch._id)} className="btn-danger !px-3 !py-1.5 text-xs">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={!!editBatch} onClose={() => setEditBatch(null)} title="Edit Inventory Batch">
        <form onSubmit={handleSubmit(onUpdate)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select {...register('category')} className="select-field"><option value="fresh">Fresh</option><option value="sprouted">Sprouted</option><option value="rotten">Rotten</option></select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select {...register('status')} className="select-field"><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="expired">Expired</option></select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Quantity (kg)</label>
              <input {...register('quantityKg', { valueAsNumber: true })} type="number" step="0.1" className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Price/kg (₹)</label>
              <input {...register('pricePerKg', { valueAsNumber: true })} type="number" step="0.01" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea {...register('description')} rows={2} className="input-field resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditBatch(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Batch" size="sm">
        <p className="text-slate-400 text-sm mb-5">Are you sure you want to delete this inventory batch? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger border">Delete</button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminInventory;
