import api from './axios';
import type { ApiResponse, AdminDashboardStats } from '../types';

export const adminApi = {
  getStats: () => api.get<ApiResponse<AdminDashboardStats>>('/admin/stats'),
};
