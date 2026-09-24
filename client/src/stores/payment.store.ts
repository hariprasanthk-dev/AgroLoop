import { create } from 'zustand';
import type { Payment, Pagination } from '../types';
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
  /** Re-fetch the list with the last-used params (after a socket update). */
  refreshPayments: () => Promise<void>;
  clearError: () => void;
  lastParams: { page?: number; limit?: number; status?: string } | null;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  lastParams: null,
  stats: null,
  pagination: null,
  isLoading: false,
  isInitiating: false,
  error: null,

  fetchPayments: async (params) => {
    set({ isLoading: true, error: null, lastParams: params ?? {} });
    try {
      const res = await paymentApi.list(params);
      set({
        payments: res.data.data ?? [],
        pagination: res.data.pagination ?? null,
        isLoading: false,
      });
    } catch (err) {
      set({ error: extractMessage(err, 'Failed to load payments'), isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await paymentApi.stats();
      set({ stats: res.data.data ?? null });
    } catch (err) {
      set({ error: extractMessage(err, 'Failed to load payment statistics') });
    }
  },

  initiatePayment: async (orderId) => {
    set({ isInitiating: true, error: null });
    try {
      const res = await paymentApi.initiate(orderId);
      set({ isInitiating: false });
      return res.data.data!;
    } catch (err) {
      const message = extractMessage(err, 'Could not start the payment. Please try again.');
      set({ error: message, isInitiating: false });
      throw new Error(message);
    }
  },

  verifyPayment: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await paymentApi.verify(data);
      set({ isLoading: false });
      return res.data.data!;
    } catch (err) {
      const message = extractMessage(err, 'We could not confirm your payment.');
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  recordFailure: async (razorpayOrderId, description) => {
    try {
      await paymentApi.failed({ razorpay_order_id: razorpayOrderId, error_description: description });
    } catch (err) {
      // Surface it: the order would otherwise keep showing "pending".
      throw new Error(extractMessage(err, 'Could not record the failed payment'));
    }
  },

  refreshPayments: async () => {
    const params = get().lastParams;
    if (params) await get().fetchPayments(params);
  },

  clearError: () => set({ error: null }),
}));
