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
  lastParams: Record<string, unknown>;

  fetchOrders: (params?: Record<string, unknown>) => Promise<void>;
  fetchStats: () => Promise<void>;
  createOrder: (data: { inventoryBatchId: string; quantityKg: number; destination: string; notes?: string }) => Promise<Order>;
  cancelOrder: (id: string) => Promise<Order>;
  acceptOrder: (id: string) => Promise<Order>;
  rejectOrder: (id: string) => Promise<Order>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<Order>;
  /**
   * Re-reads one order from the API and merges it into the list. Used when a
   * socket `order:updated` event arrives — the event itself is never trusted
   * as the new state.
   */
  refreshOrder: (id: string) => Promise<Order | null>;
  clearError: () => void;
}

/** Replace the order in the list, or prepend it when it's new to this view. */
const upsert = (orders: Order[], order: Order): Order[] =>
  orders.some((o) => o._id === order._id)
    ? orders.map((o) => (o._id === order._id ? order : o))
    : [order, ...orders];

/**
 * Mutations throw an Error carrying the server's message so the calling page
 * can show it (toast / inline) — the store never swallows failures.
 */
const mutation = async (fn: () => Promise<{ data: { data?: Order } }>, fallback: string): Promise<Order> => {
  try {
    const res = await fn();
    return res.data.data!;
  } catch (err) {
    throw new Error(extractMessage(err, fallback));
  }
};

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  stats: [],
  pagination: null,
  isLoading: false,
  error: null,
  lastParams: {},

  fetchOrders: async (params) => {
    const p = params ?? {};
    set({ isLoading: true, error: null, lastParams: p });
    try {
      const res = await orderApi.list(p as Record<string, string>);
      set({
        orders: res.data.data ?? [],
        pagination: res.data.pagination ?? null,
        isLoading: false,
      });
    } catch (err) {
      set({ error: extractMessage(err, 'Failed to load orders'), isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await orderApi.getStats();
      set({ stats: res.data.data ?? [] });
    } catch (err) {
      set({ error: extractMessage(err, 'Failed to load order statistics') });
    }
  },

  createOrder: async (data) => {
    const order = await mutation(() => orderApi.create(data), 'Failed to place order');
    set((state) => ({ orders: upsert(state.orders, order) }));
    return order;
  },

  cancelOrder: async (id) => {
    const order = await mutation(() => orderApi.cancel(id), 'Failed to cancel order');
    set((state) => ({ orders: upsert(state.orders, order) }));
    return order;
  },

  acceptOrder: async (id) => {
    const order = await mutation(() => orderApi.accept(id), 'Failed to accept order');
    set((state) => ({ orders: upsert(state.orders, order) }));
    return order;
  },

  rejectOrder: async (id) => {
    const order = await mutation(() => orderApi.reject(id), 'Failed to reject order');
    set((state) => ({ orders: upsert(state.orders, order) }));
    return order;
  },

  updateOrderStatus: async (id, status) => {
    const order = await mutation(() => orderApi.updateStatus(id, status), 'Failed to update order');
    set((state) => ({ orders: upsert(state.orders, order) }));
    return order;
  },

  refreshOrder: async (id) => {
    try {
      const res = await orderApi.getById(id);
      const order = res.data.data;
      if (!order) return null;

      // Only add an order the current filter would include.
      const statusFilter = get().lastParams.orderStatus as string | undefined;
      const inList = get().orders.some((o) => o._id === id);
      if (inList || !statusFilter || statusFilter === order.orderStatus) {
        set((state) => ({ orders: upsert(state.orders, order) }));
      } else {
        set((state) => ({ orders: state.orders.filter((o) => o._id !== id) }));
      }
      return order;
    } catch (err) {
      set({ error: extractMessage(err, 'Failed to refresh order') });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
