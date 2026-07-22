import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../api/auth.api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login({ email, password });
          const { user, token } = res.data.data!;
          localStorage.setItem('agroloop_token', token);
          set({ user, token, isLoading: false });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Login failed';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      register: async (name, email, password, role) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.register({ name, email, password, role });
          const { user, token } = res.data.data!;
          localStorage.setItem('agroloop_token', token);
          set({ user, token, isLoading: false });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Registration failed';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      logout: () => {
        localStorage.removeItem('agroloop_token');
        set({ user: null, token: null, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'agroloop_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
