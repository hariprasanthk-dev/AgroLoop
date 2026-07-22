import api from './axios';
import type { ApiResponse, Payment } from '../types';

interface PaymentStat {
  byStatus: { _id: string; count: number; totalAmount: number }[];
  recentRevenue: { _id: string; revenue: number; count: number }[];
}


export const paymentApi = {
  /** Client initiates a Razorpay order for a given orderId */
  initiate: (orderId: string) =>
    api.post<ApiResponse<{
      razorpayOrderId: string;
      amount: number;
      currency: string;
      paymentDbId: string;
      key: string;
      orderDetails: { totalAmount: number; destination: string };
    }>>('/payments/initiate', { orderId }),

  /** Client verifies payment after Razorpay Checkout succeeds */
  verify: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => api.post<ApiResponse<{ payment: Payment; orderId: string }>>('/payments/verify', data),

  /** Client records a failed payment attempt */
  failed: (data: { razorpay_order_id: string; error_description?: string }) =>
    api.post<ApiResponse<Payment>>('/payments/failed', data),

  /** List payments — client sees own, admin sees all */
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<ApiResponse<Payment[]>>('/payments', { params }),

  /** Admin: payment statistics */
  stats: () => api.get<ApiResponse<PaymentStat>>('/payments/stats'),

  /** Get payment for a specific order */
  getByOrderId: (orderId: string) =>
    api.get<ApiResponse<Payment>>(`/payments/${orderId}`),
};
