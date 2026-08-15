import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, ShoppingCart, Package, Loader2, MapPin, Filter,
  ChevronDown, ChevronUp, X, Eye, Calendar, TrendingUp,
} from 'lucide-react';
import { useInventoryStore } from '../../stores/inventory.store';
import { useOrderStore } from '../../stores/order.store';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import { formatCurrency, formatDate, formatWeight, getCategoryIcon } from '../../utils/helpers';
import type { InventoryBatch } from '../../types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ─── Order Form Schema ────────────────────────────────────────────────────────
const orderSchema = z.object({
  quantityKg:  z.number({ message: 'Enter a valid number' }).positive('Must be positive'),
  destination: z.string().min(3, 'Enter a destination address'),
  notes:       z.string().optional(),
});
type OrderForm = z.infer<typeof orderSchema>;

// ─── Filter State ─────────────────────────────────────────────────────────────
interface FilterState {
  search: string;
  category: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  minQty: string;
}

const defaultFilters: FilterState = {
  search: '', category: '', location: '', minPrice: '', maxPrice: '', minQty: '',
};

// ─── Category Guide Cards ─────────────────────────────────────────────────────
const CATEGORIES = [
  { cat: 'fresh',    icon: '🧅', title: 'Fresh (Grade A)', desc: 'For consumers, restaurants, grocery stores',  color: 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10' },
  { cat: 'sprouted', icon: '🌱', title: 'Sprouted Onions', desc: 'For farmers — ideal for cultivation',          color: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10'    },
  { cat: 'rotten',   icon: '♻️', title: 'Rotten Onions',   desc: 'Available for purchase at low prices',         color: 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10'        },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────
const BrowseInventory: React.FC = () => {
  const { batches, isLoading, pagination, fetchBatches } = useInventoryStore();
  const { createOrder } = useOrderStore();

  const [filters, setFilters]         = useState<FilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [orderBatch, setOrderBatch]   = useState<InventoryBatch | null>(null);
  const [detailBatch, setDetailBatch] = useState<InventoryBatch | null>(null);
  const [ordering, setOrdering]       = useState(false);
  const [success, setSuccess]         = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
  });
  const qty = watch('quantityKg');

  // ── Fetch with filters ────────────────────────────────────────────────────
  const applyFilters = useCallback(() => {
    fetchBatches({
      status: 'available',
      category: filters.category || undefined,
      location: filters.location || undefined,
      minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
      minQty:   filters.minQty   ? parseFloat(filters.minQty)   : undefined,
      limit: 50,
    });
  }, [filters, fetchBatches]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  // ── Client-side text search (category / farmer / description) ─────────────
  const displayed = batches.filter(b => {
    if (!filters.search) return true;
    const q = filters.search.toLowerCase();
    const farmer = typeof b.farmerId === 'object' ? b.farmerId.name : '';
    return (
      b.category.includes(q) ||
      farmer.toLowerCase().includes(q) ||
      (b.description ?? '').toLowerCase().includes(q) ||
      b.location.toLowerCase().includes(q)
    );
  });

  // ── Place Order ───────────────────────────────────────────────────────────
  const onPlaceOrder = async (data: OrderForm) => {
    if (!orderBatch) return;
    setOrdering(true);
    try {
      await createOrder({
        inventoryBatchId: orderBatch._id,
        quantityKg:       data.quantityKg,
        destination:      data.destination,
        notes:            data.notes,
      });
      setSuccess(true);
      reset();
      setTimeout(() => { setOrderBatch(null); setSuccess(false); }, 2200);
    } catch {/* error in store */}
    setOrdering(false);
  };

  const setFilter = (key: keyof FilterState, value: string) =>
    setFilters(f => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters(defaultFilters);
  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Browse Inventory</h1>
          <p className="page-subtitle">
            {pagination ? `${pagination.total} batch${pagination.total !== 1 ? 'es' : ''} available` : 'Find the right onion batch for your needs'}
          </p>
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn-secondary text-xs gap-1">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* ── Category Quick Filters ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CATEGORIES.map(item => (
          <button
            key={item.cat}
            id={`cat-filter-${item.cat}`}
            onClick={() => setFilter('category', filters.category === item.cat ? '' : item.cat)}
            className={`glass-card p-4 text-left border transition-all duration-200 rounded-2xl ${
              filters.category === item.cat ? item.color : 'border-slate-700/50 hover:border-slate-600/50'
            }`}
          >
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="font-semibold text-slate-200 text-sm">{item.title}</p>
            <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
          </button>
        ))}
      </div>

      {/* ── Search + Advanced Filters ─────────────────────────────────────── */}
      <div className="glass-card p-4 space-y-3">
        {/* Main search row */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="search-input"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              placeholder="Search by category, farmer, location…"
              className="input-field pl-10"
            />
          </div>
          <button
            id="toggle-filters-btn"
            onClick={() => setFiltersOpen(o => !o)}
            className={`btn-secondary gap-2 shrink-0 ${filtersOpen ? 'bg-slate-700' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Advanced filter panel */}
        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-700/40">
            {/* Location */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  id="location-filter"
                  value={filters.location}
                  onChange={e => setFilter('location', e.target.value)}
                  placeholder="e.g. Nashik"
                  className="input-field pl-8 py-2 text-xs"
                />
              </div>
            </div>

            {/* Min Price */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min Price (₹/kg)</label>
              <input
                id="min-price-filter"
                type="number"
                value={filters.minPrice}
                onChange={e => setFilter('minPrice', e.target.value)}
                placeholder="e.g. 10"
                className="input-field py-2 text-xs"
                min={0}
              />
            </div>

            {/* Max Price */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Max Price (₹/kg)</label>
              <input
                id="max-price-filter"
                type="number"
                value={filters.maxPrice}
                onChange={e => setFilter('maxPrice', e.target.value)}
                placeholder="e.g. 50"
                className="input-field py-2 text-xs"
                min={0}
              />
            </div>

            {/* Min Quantity */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min Quantity (kg)</label>
              <input
                id="min-qty-filter"
                type="number"
                value={filters.minQty}
                onChange={e => setFilter('minQty', e.target.value)}
                placeholder="e.g. 100"
                className="input-field py-2 text-xs"
                min={0}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Batch Grid ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingSpinner className="py-20" size="lg" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.length === 0 ? (
            <div className="col-span-full empty-state">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-slate-400">No available batches match your filters</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 btn-secondary text-xs">Clear all filters</button>
              )}
            </div>
          ) : displayed.map(batch => {
            const farmer = typeof batch.farmerId === 'object' ? batch.farmerId : null;
            const totalValue = batch.quantityKg * batch.pricePerKg;
            return (
              <div
                key={batch._id}
                className="glass-card p-5 flex flex-col gap-3 hover:border-emerald-500/30 transition-all duration-300 hover:scale-[1.01]"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{getCategoryIcon(batch.category)}</div>
                  <Badge label={batch.category} type="category" />
                </div>

                {/* Title + Description */}
                <div>
                  <h3 className="font-bold text-slate-200 capitalize">{batch.category} Onions</h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {batch.description ?? 'Quality onion batch available for purchase.'}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Available</span>
                    <span className="font-semibold text-slate-200">{formatWeight(batch.quantityKg)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Price</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(batch.pricePerKg)}/kg</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location</span>
                    <span className="text-slate-300 text-xs truncate max-w-[120px]">{batch.location}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Farmer</span>
                    <span className="text-slate-300">{farmer?.name ?? '—'}</span>
                  </div>
                  {batch.harvestDate && (
                    <div className="flex justify-between text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Harvest</span>
                      <span className="text-slate-300">{formatDate(batch.harvestDate)}</span>
                    </div>
                  )}
                </div>

                {/* Batch image */}
                {batch.imageUrl && (
                  <img
                    src={batch.imageUrl}
                    alt={batch.category}
                    className="w-full h-28 object-cover rounded-xl border border-slate-700/40"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}

                {/* Batch value pill */}
                <div className="flex items-center justify-between bg-slate-700/30 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-500">Batch value</span>
                  <span className="text-sm font-bold text-slate-200">{formatCurrency(totalValue)}</span>
                </div>

                {/* CTA Buttons */}
                <div className="flex gap-2 mt-auto">
                  <button
                    id={`view-detail-${batch._id}`}
                    onClick={() => setDetailBatch(batch)}
                    className="btn-secondary flex-1 justify-center"
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button
                    id={`order-btn-${batch._id}`}
                    onClick={() => { setOrderBatch(batch); reset(); }}
                    className="btn-primary flex-1 justify-center"
                  >
                    <ShoppingCart className="w-4 h-4" /> Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DETAIL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!detailBatch} onClose={() => setDetailBatch(null)} title="Inventory Details" size="lg">
        {detailBatch && (() => {
          const farmer = typeof detailBatch.farmerId === 'object' ? detailBatch.farmerId : null;
          return (
            <div className="space-y-5">
              {/* Hero */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-700/30 border border-slate-600/30">
                <span className="text-5xl">{getCategoryIcon(detailBatch.category)}</span>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-100 capitalize">{detailBatch.category} Onions</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge label={detailBatch.category} type="category" />
                    <Badge label={detailBatch.status} />
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Quantity Available', value: formatWeight(detailBatch.quantityKg), icon: '📦' },
                  { label: 'Price per kg', value: formatCurrency(detailBatch.pricePerKg), icon: '💰' },
                  { label: 'Batch Value', value: formatCurrency(detailBatch.quantityKg * detailBatch.pricePerKg), icon: '🏷️' },
                  { label: 'Farmer', value: farmer?.name ?? '—', icon: '👨‍🌾' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/20">
                    <p className="text-xs text-slate-500 mb-1">{icon} {label}</p>
                    <p className="font-semibold text-slate-200">{value}</p>
                  </div>
                ))}
              </div>

              {/* Location & Dates */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/20">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-slate-200 font-medium">{detailBatch.location}</p>
                  </div>
                </div>
                {detailBatch.harvestDate && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/20">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Harvest Date</p>
                      <p className="text-slate-200 font-medium">{formatDate(detailBatch.harvestDate)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/20">
                  <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Intake Date</p>
                    <p className="text-slate-200 font-medium">{formatDate(detailBatch.intakeDate)}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {detailBatch.description && (
                <div className="p-4 rounded-xl bg-slate-700/20 border border-slate-600/20">
                  <p className="text-xs text-slate-500 mb-2">Description</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{detailBatch.description}</p>
                </div>
              )}

              {/* Batch image */}
              {detailBatch.imageUrl && (
                <img
                  src={detailBatch.imageUrl}
                  alt={detailBatch.category}
                  className="w-full max-h-48 object-cover rounded-2xl border border-slate-700/40"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}

              {/* Action */}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDetailBatch(null)} className="btn-secondary">Close</button>
                <button
                  id={`order-from-detail-${detailBatch._id}`}
                  onClick={() => { setDetailBatch(null); setOrderBatch(detailBatch); reset(); }}
                  className="btn-primary"
                >
                  <ShoppingCart className="w-4 h-4" /> Place Order
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          PLACE ORDER MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!orderBatch} onClose={() => setOrderBatch(null)} title="Place Order" size="md">
        {success ? (
          <div className="py-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-lg font-bold text-emerald-400">Order Placed!</p>
            <p className="text-slate-400 text-sm mt-1">Your order is pending admin approval.</p>
          </div>
        ) : orderBatch && (
          <form onSubmit={handleSubmit(onPlaceOrder)} className="space-y-4">
            {/* Batch summary */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/30 border border-slate-600/30">
              <span className="text-2xl">{getCategoryIcon(orderBatch.category)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-200 capitalize">{orderBatch.category} Onions</p>
                <p className="text-xs text-slate-500">
                  Max: {formatWeight(orderBatch.quantityKg)} · {formatCurrency(orderBatch.pricePerKg)}/kg · {orderBatch.location}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Quantity (kg) <span className="text-red-400">*</span></label>
              <input
                {...register('quantityKg', { valueAsNumber: true })}
                type="number" step="0.1" max={orderBatch.quantityKg}
                className="input-field" placeholder="e.g. 50"
              />
              {errors.quantityKg && <p className="text-red-400 text-xs mt-1">{errors.quantityKg.message}</p>}
              {qty > 0 && !isNaN(qty) && (
                <p className="text-xs text-emerald-400 mt-1">
                  Estimated total: {formatCurrency(qty * orderBatch.pricePerKg)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Delivery Destination <span className="text-red-400">*</span></label>
              <input {...register('destination')} className="input-field" placeholder="e.g. Mumbai, Maharashtra" />
              {errors.destination && <p className="text-red-400 text-xs mt-1">{errors.destination.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
              <textarea {...register('notes')} rows={2} className="input-field resize-none" placeholder="Any special instructions…" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setOrderBatch(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={ordering} className="btn-primary">
                {ordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {ordering ? 'Placing…' : 'Confirm Order'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default BrowseInventory;
