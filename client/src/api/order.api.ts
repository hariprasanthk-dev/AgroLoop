import api from './axios';
import type { ApiResponse, Order, OrderStat, OrderStatus } from '../types';

interface ListParams {
  page?: number;
  limit?: number;
  orderStatus?: string;
  clientId?: string;
}

export const orderApi = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<Order[]>>('/orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  create: (data: { inventoryBatchId: string; quantityKg: number; destination: string; notes?: string }) =>
    api.post<ApiResponse<Order>>('/orders', data),

  // Client cancels a pending order
  cancel: (id: string) =>
    api.delete<ApiResponse<Order>>(`/orders/${id}`),

  // Farmer accepts a pending order
  accept: (id: string) =>
    api.put<ApiResponse<Order>>(`/orders/${id}/accept`),

  // Farmer rejects a pending order
  reject: (id: string) =>
    api.put<ApiResponse<Order>>(`/orders/${id}/reject`),

  // Farmer advances status: accepted → packed → shipped → delivered
  updateStatus: (id: string, orderStatus: OrderStatus) =>
    api.put<ApiResponse<Order>>(`/orders/${id}/status`, { orderStatus }),

  getStats: () =>
    api.get<ApiResponse<OrderStat[]>>('/orders/stats'),
};
