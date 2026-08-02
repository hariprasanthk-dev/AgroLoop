import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Package, MapPin, Calendar, TrendingUp, Weight } from 'lucide-react';
import { useInventoryStore } from '../../stores/inventory.store';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import SummaryCard from '../../components/inventory/SummaryCard';
import ImageUploader from '../../components/inventory/ImageUploader';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { InventoryBatch } from '../../types';

// ─── Zod Schema ───────────────────────────────────────────────────────────────
const batchSchema = z.object({
  category:    z.enum(['fresh', 'sprouted', 'rotten'], { message: 'Select a category' }),
  quantityKg:  z.number({ message: 'Required' }).positive('Must be positive'),
  pricePerKg:  z.number({ message: 'Required' }).positive('Must be positive'),
  location:    z.string().min(2, 'Location is required'),
  harvestDate: z.string().optional(),
  status:      z.enum(['available', 'reserved', 'sold', 'expired']).optional(),
  description: z.string().optional(),
  imageUrl:    z.string().optional(),
});
type BatchForm = z.infer<typeof batchSchema>;

// ─── Main Component ───────────────────────────────────────────────────────────
const FarmerInventory: React.FC = () => {

  const { batches, isLoading, error, fetchBatches, fetchStats, createBatch, updateBatch, deleteBatch } = useInventoryStore();

  const [addOpen, setAddOpen]       = useState(false);
  const [editBatch, setEditBatch]   = useState<InventoryBatch | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // ── Add Form ─────────────────────────────────────────────────────────────
  const addForm = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: { category: 'fresh', status: 'available' },
  });

  // ── Edit Form ─────────────────────────────────────────────────────────────
  const editForm = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
  });

  useEffect(() => {
    fetchBatches();
    fetchStats();
  }, [fetchBatches, fetchStats]);

  // When editBatch changes, populate edit form
  useEffect(() => {
    if (editBatch) {
      editForm.reset({
        category:    editBatch.category,
        quantityKg:  editBatch.quantityKg,
        pricePerKg:  editBatch.pricePerKg,
        location:    editBatch.location,
        harvestDate: editBatch.harvestDate ? editBatch.harvestDate.split('T')[0] : '',
        status:      editBatch.status,
        description: editBatch.description ?? '',
        imageUrl:    editBatch.imageUrl ?? '',
      });
    }
  }, [editBatch, editForm]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalKg      = batches.reduce((s, b) => s + b.quantityKg, 0);
  const availableKg  = batches.filter(b => b.status === 'available').reduce((s, b) => s + b.quantityKg, 0);
  const freshKg      = batches.filter(b => b.category === 'fresh').reduce((s, b) => s + b.quantityKg, 0);
  const sproutedKg   = batches.filter(b => b.category === 'sprouted').reduce((s, b) => s + b.quantityKg, 0);
  const rottenKg     = batches.filter(b => b.category === 'rotten').reduce((s, b) => s + b.quantityKg, 0);

  // ── Add Batch ─────────────────────────────────────────────────────────────
  const onAdd = async (data: BatchForm) => {
    setSubmitting(true);
    try {
      await createBatch({
        ...data,
        intakeDate: new Date().toISOString(),
        harvestDate: data.harvestDate || undefined,
        imageUrl: data.imageUrl || undefined,
      });
      setSuccessMsg('Batch Added!');
      addForm.reset({ category: 'fresh', status: 'available' });
      setTimeout(() => { setAddOpen(false); setSuccessMsg(''); }, 1500);
    } catch { /* error handled by store */ }
    setSubmitting(false);
  };

  // ── Edit Batch ────────────────────────────────────────────────────────────
  const onEdit = async (data: BatchForm) => {
    if (!editBatch) return;
    setSubmitting(true);
    try {
      await updateBatch(editBatch._id, {
        ...data,
        harvestDate: data.harvestDate || undefined,
        imageUrl: data.imageUrl || undefined,
      } as never);
      setSuccessMsg('Batch Updated!');
      setTimeout(() => { setEditBatch(null); setSuccessMsg(''); }, 1500);
    } catch { /* error handled by store */ }
    setSubmitting(false);
  };

  // ── Delete Batch ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteBatch(deleteId);
    setDeleteId(null);
  };

  // ── Batch Form Fields (reused for Add & Edit) ─────────────────────────────
  const BatchFormFields: React.FC<{
    form: ReturnType<typeof useForm<BatchForm>>;
    showStatus?: boolean;
  }> = ({ form, showStatus = false }) => {
    const { register, formState: { errors } } = form;
    return (
      <div className="space-y-4">
        {/* Row 1: Category + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category <span className="text-red-400">*</span></label>
            <select {...register('category')} className="select-field">
              <option value="fresh">🧅 Fresh (Grade A)</option>
              <option value="sprouted">🌱 Sprouted</option>
              <option value="rotten">♻️ Rotten</option>
            </select>
            {errors.category && <p className="text-red-400 text-xs mt-1">{errors.category.message}</p>}
          </div>
          {showStatus && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select {...register('status')} className="select-field">
                <option value="available">✅ Available</option>
                <option value="reserved">🔒 Reserved</option>
                <option value="sold">✔️ Sold</option>
                <option value="expired">❌ Expired</option>
              </select>
            </div>
          )}
          {!showStatus && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Quantity (kg) <span className="text-red-400">*</span></label>
              <input {...register('quantityKg', { valueAsNumber: true })} type="number" step="0.1" className="input-field" placeholder="e.g. 500" />
              {errors.quantityKg && <p className="text-red-400 text-xs mt-1">{errors.quantityKg.message}</p>}
            </div>
          )}
        </div>

        {/* Row 2: Qty + Price (edit shows all) */}
        <div className="grid grid-cols-2 gap-4">
          {showStatus && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Quantity (kg) <span className="text-red-400">*</span></label>
              <input {...register('quantityKg', { valueAsNumber: true })} type="number" step="0.1" className="input-field" placeholder="e.g. 500" />
              {errors.quantityKg && <p className="text-red-400 text-xs mt-1">{errors.quantityKg.message}</p>}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Price per kg (₹) <span className="text-red-400">*</span></label>
            <input {...register('pricePerKg', { valueAsNumber: true })} type="number" step="0.01" className="input-field" placeholder="e.g. 25" />
            {errors.pricePerKg && <p className="text-red-400 text-xs mt-1">{errors.pricePerKg.message}</p>}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Location <span className="text-red-400">*</span></label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input {...register('location')} className="input-field pl-9" placeholder="e.g. Nashik, Maharashtra" />
          </div>
          {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location.message}</p>}
        </div>

        {/* Harvest Date */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Harvest Date (optional)</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input {...register('harvestDate')} type="date" className="input-field pl-9" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Description</label>
          <textarea {...register('description')} rows={2} className="input-field resize-none" placeholder="Quality details, storage info…" />
        </div>

        {/* Image Upload */}
        <ImageUploader
          value={form.watch('imageUrl')}
          onChange={(url) => form.setValue('imageUrl', url, { shouldValidate: true, shouldDirty: true })}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Inventory</h1>
          <p className="page-subtitle">{batches.length} batch{batches.length !== 1 ? 'es' : ''} listed</p>
        </div>
        <button id="add-batch-btn" onClick={() => { setAddOpen(true); addForm.reset({ category: 'fresh', status: 'available' }); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Batch
        </button>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Package className="w-5 h-5 text-blue-400" />}
          label="Total Stock"
          value={formatWeight(totalKg)}
          sub={`${formatWeight(availableKg)} available`}
          color="border-blue-500/30"
        />
        <SummaryCard
          icon={<span className="text-xl">🧅</span>}
          label="Fresh (Grade A)"
          value={formatWeight(freshKg)}
          sub={`${batches.filter(b => b.category === 'fresh').length} batches`}
          color="border-emerald-500/30"
        />
        <SummaryCard
          icon={<span className="text-xl">🌱</span>}
          label="Sprouted"
          value={formatWeight(sproutedKg)}
          sub={`${batches.filter(b => b.category === 'sprouted').length} batches`}
          color="border-amber-500/30"
        />
        <SummaryCard
          icon={<span className="text-xl">♻️</span>}
          label="Rotten"
          value={formatWeight(rottenKg)}
          sub={`${batches.filter(b => b.category === 'rotten').length} batches`}
          color="border-red-500/30"
        />
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="glass-card p-4 border border-red-500/30 bg-red-500/10">
          <p className="text-red-400 text-sm">⚠️ {error}</p>
        </div>
      )}

      {/* ── Batch Grid ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.length === 0 ? (
            <div className="col-span-full glass-card empty-state py-20">
              <p className="text-5xl mb-3">🧅</p>
              <p className="text-slate-400">No inventory yet. Start by adding your first batch.</p>
              <button onClick={() => setAddOpen(true)} className="btn-primary mt-4">
                <Plus className="w-4 h-4" /> Add First Batch
              </button>
            </div>
          ) : batches.map(batch => (
            <div key={batch._id} className="glass-card p-5 flex flex-col gap-3 hover:border-slate-600/50 transition-all duration-300">
              {/* Header */}
              <div className="flex items-start justify-between">
                <span className="text-3xl">{getCategoryIcon(batch.category)}</span>
                <Badge label={batch.status} />
              </div>

              {/* Title */}
              <div>
                <h3 className="font-bold text-slate-200 capitalize">{batch.category} Onions</h3>
                {batch.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{batch.description}</p>}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <p className="text-slate-500 text-xs flex items-center gap-1"><Weight className="w-3 h-3" /> Quantity</p>
                  <p className="font-semibold text-slate-200">{formatWeight(batch.quantityKg)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Price/kg</p>
                  <p className="font-semibold text-emerald-400">{formatCurrency(batch.pricePerKg)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
                  <p className="font-semibold text-slate-200 text-xs">{batch.location}</p>
                </div>
                {batch.harvestDate && (
                  <div>
                    <p className="text-slate-500 text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Harvest</p>
                    <p className="font-semibold text-slate-200 text-xs">{formatDate(batch.harvestDate)}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs">Intake</p>
                  <p className="font-semibold text-slate-200 text-xs">{formatDate(batch.intakeDate)}</p>
                </div>
              </div>

              {/* Category badge */}
              <Badge label={batch.category} type="category" />

              {/* Image */}
              {batch.imageUrl && (
                <img
                  src={batch.imageUrl}
                  alt={batch.category}
                  className="w-full h-32 object-cover rounded-xl border border-slate-700/40"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                <button
                  id={`edit-btn-${batch._id}`}
                  onClick={() => setEditBatch(batch)}
                  className="btn-secondary flex-1 justify-center"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  id={`delete-btn-${batch._id}`}
                  onClick={() => setDeleteId(batch._id)}
                  className="btn-danger flex-1 justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADD BATCH MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); setSuccessMsg(''); }} title="Add Inventory Batch" size="lg">
        {successMsg ? (
          <div className="py-10 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-lg font-bold text-emerald-400">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-4">
            <BatchFormFields form={addForm} showStatus={false} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? 'Adding…' : 'Add Batch'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT BATCH MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!editBatch} onClose={() => { setEditBatch(null); setSuccessMsg(''); }} title="Edit Inventory Batch" size="lg">
        {successMsg ? (
          <div className="py-10 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-lg font-bold text-emerald-400">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
            <BatchFormFields form={editForm} showStatus={true} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditBatch(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          DELETE CONFIRM MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Batch" size="sm">
        <div className="py-2">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
            <Trash2 className="w-8 h-8 text-red-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-200">Confirm Deletion</p>
              <p className="text-slate-400 text-sm mt-0.5">This inventory batch will be permanently deleted. This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button id="cancel-delete-btn" onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
            <button id="confirm-delete-btn" onClick={handleDelete} className="btn-danger border border-red-500/30 font-semibold">
              <Trash2 className="w-4 h-4" /> Delete Permanently
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FarmerInventory;
