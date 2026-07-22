import { create } from 'zustand';
import type { AdminDashboardStats } from '../types';
import { adminApi } from '../api/admin.api';

interface AdminState {
  stats: AdminDashboardStats | null;
  isLoading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  stats: null,
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await adminApi.getStats();
      set({ stats: res.data.data ?? null, isLoading: false });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch admin dashboard statistics';
      set({ error: message, isLoading: false });
    }
  },
}));
