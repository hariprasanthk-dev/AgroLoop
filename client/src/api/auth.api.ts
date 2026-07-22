import api from './axios';
import type { ApiResponse, AuthResponse } from '../types';

export const authApi = {
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),
  getMe: () => api.get<ApiResponse<AuthResponse['user']>>('/auth/me'),
};
