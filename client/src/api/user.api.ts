import api from './axios';
import type { ApiResponse, User } from '../types';

export const userApi = {
  list: () => api.get<ApiResponse<User[]>>('/users'),
  getById: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),
  delete: (id: string) => api.delete<ApiResponse<null>>(`/users/${id}`),
  updateRole: (id: string, role: string) =>
    api.patch<ApiResponse<User>>(`/users/${id}/role`, { role }),
};
