import axios, { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ─── Request Interceptor: Attach JWT ─────────────────────────────────────────
// Token is read from the Zustand store (the single source of truth) rather than
// from localStorage directly, which could be out of sync with the store state.
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * True only when a 401 means "your session is no longer valid": the request
 * was authenticated and it was not one of the auth endpoints. A 401 from
 * /auth/login is a normal "wrong password" response and must reach the form.
 */
export const isSessionExpiredError = (error: Pick<AxiosError, 'response' | 'config'>): boolean => {
  if (error.response?.status !== 401) return false;
  const url = error.config?.url ?? '';
  if (/(^|\/)auth\/(login|register|forgot-password|reset-password|verify-email)/.test(url)) return false;
  const authHeader = error.config?.headers?.Authorization ?? error.config?.headers?.authorization;
  return Boolean(authHeader);
};

// ─── Response Interceptor: Handle expired sessions ───────────────────────────
// Clearing the store is enough: ProtectedRoute re-renders and redirects to
// /login. No full-page reload, so no in-flight UI state or messages are lost.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (isSessionExpiredError(error) && useAuthStore.getState().token) {
      useAuthStore.getState().logout();
      toast.error('Your session has expired. Please sign in again.', { id: 'session-expired' });
    }
    return Promise.reject(error);
  }
);

export default api;
