import { create } from 'zustand';
import type { InventoryBatch, InventoryStat, Pagination } from '../types';
import { inventoryApi } from '../api/inventory.api';

interface InventoryState {
  batches: InventoryBatch[];
  stats: InventoryStat[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  lastParams: Record<string, unknown>;

  fetchBatches: (params?: Record<string, unknown>) => Promise<void>;
  fetchStats: () => Promise<void>;
  createBatch: (data: Record<string, unknown>) => Promise<void>;
  updateBatch: (id: string, data: Partial<InventoryBatch>) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  clearError: () => void;
}

const extractMessage = (err: unknown) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong';

export const useInventoryStore = create<InventoryState>((set, get) => ({
  batches: [],
  stats: [],
  pagination: null,
  isLoading: false,
  error: null,
  lastParams: {},

  fetchBatches: async (params) => {
    const p = params ?? {};
    set({ isLoading: true, error: null, lastParams: p });
    try {
      const res = await inventoryApi.list(p as Record<string, string>);
      set({ batches: res.data.data ?? [], pagination: res.data.pagination ?? null, isLoading: false });
    } catch (err) {
      set({ error: extractMessage(err), isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await inventoryApi.getStats();
      set({ stats: res.data.data ?? [] });
    } catch {/* silent */}
  },

  createBatch: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await inventoryApi.create(data);
      // Re-fetch with last params so list is authoritative from server
      await get().fetchBatches(get().lastParams);
    } catch (err) {
      set({ error: extractMessage(err), isLoading: false });
      throw err;
    }
  },

  updateBatch: async (id, data) => {
    try {
      await inventoryApi.update(id, data);
      // Re-fetch to get server-authoritative data
      await get().fetchBatches(get().lastParams);
    } catch (err) {
      set({ error: extractMessage(err) });
      throw err;
    }
  },

  deleteBatch: async (id) => {
    try {
      await inventoryApi.delete(id);
      // Optimistic local removal
      set((state) => ({ batches: state.batches.filter((b) => b._id !== id) }));
    } catch (err) {
      set({ error: extractMessage(err) });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
