import { create } from 'zustand';
import type { Order, OrderStat, OrderStatus, Pagination } from '../types';
import { orderApi } from '../api/order.api';
import { extractMessage } from '../utils/helpers';

interface OrderState {
  orders: Order[];
  stats: OrderStat[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;

  fetchOrders: (params?: Record<string, unknown>) => Promise<void>;
  fetchStats: () => Promise<void>;
  createOrder: (data: { inventoryBatchId: string; quantityKg: number; destination: string; notes?: string }) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
  acceptOrder: (id: string) => Promise<void>;
  rejectOrder: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  /** Called by the socket hook to sync a real-time status change */
  updateOrderInList: (orderId: string, newStatus: OrderStatus) => void;
  updateOrderPaymentStatusInList: (orderId: string, newPaymentStatus: 'pending' | 'paid' | 'failed' | 'refunded') => void;
  clearError: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  stats: [],
  pagination: null,
  isLoading: false,
  error: null,

  fetchOrders: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await orderApi.list(params as Record<string, string>);
      set({
        orders: res.data.data ?? [],
        pagination: res.data.pagination ?? null,
        isLoading: false,
      });
    } catch (err) {
      set({ error: extractMessage(err), isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await orderApi.getStats();
      set({ stats: res.data.data ?? [] });
    } catch {/* silent */}
  },

  createOrder: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await orderApi.create(data);
      set((state) => ({
        orders: [res.data.data!, ...state.orders],
        isLoading: false,
      }));
    } catch (err) {
      set({ error: extractMessage(err), isLoading: false });
      throw err;
    }
  },

  cancelOrder: async (id) => {
    try {
      await orderApi.cancel(id);
      set((state) => ({
        orders: state.orders.map((o) =>
          o._id === id ? { ...o, orderStatus: 'cancelled' as OrderStatus } : o
        ),
      }));
    } catch (err) {
      set({ error: extractMessage(err) });
      throw err;
    }
  },

  acceptOrder: async (id) => {
    try {
      const res = await orderApi.accept(id);
      set((state) => ({
        orders: state.orders.map((o) => (o._id === id ? res.data.data! : o)),
      }));
    } catch (err) {
      set({ error: extractMessage(err) });
      throw err;
    }
  },

  rejectOrder: async (id) => {
    try {
      const res = await orderApi.reject(id);
      set((state) => ({
        orders: state.orders.map((o) => (o._id === id ? res.data.data! : o)),
      }));
    } catch (err) {
      set({ error: extractMessage(err) });
      throw err;
    }
  },

  updateOrderStatus: async (id, status) => {
    try {
      const res = await orderApi.updateStatus(id, status);
      set((state) => ({
        orders: state.orders.map((o) => (o._id === id ? res.data.data! : o)),
      }));
    } catch (err) {
      set({ error: extractMessage(err) });
      throw err;
    }
  },

  updateOrderInList: (orderId, newStatus) => {
    const existing = get().orders.find((o) => o._id === orderId);
    if (!existing) return;
    set((state) => ({
      orders: state.orders.map((o) =>
        o._id === orderId ? { ...o, orderStatus: newStatus } : o
      ),
    }));
  },

  updateOrderPaymentStatusInList: (orderId, newPaymentStatus) => {
    const existing = get().orders.find((o) => o._id === orderId);
    if (!existing) return;
    set((state) => ({
      orders: state.orders.map((o) =>
        o._id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
