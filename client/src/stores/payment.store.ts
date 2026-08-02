import { create } from 'zustand';
import type { Payment, Pagination, PaymentStatus } from '../types';
import { paymentApi } from '../api/payment.api';
import { extractMessage } from '../utils/helpers';

interface PaymentStat {
  byStatus: { _id: string; count: number; totalAmount: number }[];
  recentRevenue: { _id: string; revenue: number; count: number }[];
}

interface RazorpayInitData {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  paymentDbId: string;
  key: string;
  orderDetails: { totalAmount: number; destination: string };
}

interface PaymentState {
  payments: Payment[];
  stats: PaymentStat | null;
  pagination: Pagination | null;
  isLoading: boolean;
  isInitiating: boolean;
  error: string | null;

  fetchPayments: (params?: { page?: number; limit?: number; status?: string }) => Promise<void>;
  fetchStats: () => Promise<void>;
  initiatePayment: (orderId: string) => Promise<RazorpayInitData>;
  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => Promise<{ payment: Payment; orderId: string }>;
  recordFailure: (razorpayOrderId: string, description?: string) => Promise<void>;
  updatePaymentStatus: (orderId: string, status: PaymentStatus) => void;
  clearError: () => void;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  payments: [],
  stats: null,
  pagination: null,
  isLoading: false,
  isInitiating: false,
  error: null,

  fetchPayments: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await paymentApi.list(params);
      set({
        payments: res.data.data ?? [],
        pagination: res.data.pagination ?? null,
        isLoading: false,
      });
    } catch (err) {
      set({ error: extractMessage(err), isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await paymentApi.stats();
      set({ stats: res.data.data ?? null });
    } catch {/* silent */}
  },

  initiatePayment: async (orderId) => {
    set({ isInitiating: true, error: null });
    try {
      const res = await paymentApi.initiate(orderId);
      set({ isInitiating: false });
      return res.data.data!;
    } catch (err) {
      set({ error: extractMessage(err), isInitiating: false });
      throw err;
    }
  },

  verifyPayment: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await paymentApi.verify(data);
      set({ isLoading: false });
      return res.data.data!;
    } catch (err) {
      set({ error: extractMessage(err), isLoading: false });
      throw err;
    }
  },

  recordFailure: async (razorpayOrderId, description) => {
    try {
      await paymentApi.failed({ razorpay_order_id: razorpayOrderId, error_description: description });
    } catch {/* silent — UI already shows failure */}
  },

  updatePaymentStatus: (orderId, status) => {
    set((state) => ({
      payments: state.payments.map((p) => {
        const pOrderId = typeof p.orderId === 'object' ? p.orderId._id : p.orderId;
        return pOrderId === orderId ? { ...p, status } : p;
      }),
    }));
  },

  clearError: () => set({ error: null }),
}));
