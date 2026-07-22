import api from './axios';
import type { ApiResponse, InventoryBatch, InventoryStat } from '../types';

interface ListParams {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
  farmerId?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minQty?: number;
  maxQty?: number;
}

export const inventoryApi = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<InventoryBatch[]>>('/inventory', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<InventoryBatch>>(`/inventory/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post<ApiResponse<InventoryBatch>>('/inventory', data),

  update: (id: string, data: Partial<InventoryBatch>) =>
    api.put<ApiResponse<InventoryBatch>>(`/inventory/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/inventory/${id}`),

  getStats: () =>
    api.get<ApiResponse<InventoryStat[]>>('/inventory/stats'),
};
