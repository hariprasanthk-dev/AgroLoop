import api from './axios';
import type { ApiResponse, AuthResponse } from '../types';

export const authApi = {
  // ─── Existing ──────────────────────────────────────────────────────────────
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),

  getMe: () => api.get<ApiResponse<AuthResponse['user']>>('/auth/me'),

  // ─── Email verification ────────────────────────────────────────────────────
  sendVerification: () =>
    api.post<ApiResponse<null>>('/auth/send-verification'),

  verifyEmail: (token: string) =>
    api.get<ApiResponse<{ verified: boolean }>>(`/auth/verify-email?token=${token}`),

  // ─── Password reset ────────────────────────────────────────────────────────
  forgotPassword: (email: string) =>
    api.post<ApiResponse<null>>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<ApiResponse<null>>('/auth/reset-password', { token, password }),
};
