import api from './axios';
import type { ApiResponse, Notification } from '../types';

export const notificationApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ notifications: Notification[]; unreadCount: number }>>('/notifications', { params }),

  markRead: (id: string) =>
    api.patch<ApiResponse<Notification>>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.patch<ApiResponse<null>>('/notifications/read-all'),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/notifications/${id}`),
};
