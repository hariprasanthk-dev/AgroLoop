import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../api/auth.api';
import { extractMessage } from '../utils/helpers';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  /**
   * True once Zustand's persist middleware has finished rehydrating state
   * from localStorage. Components that depend on auth (e.g. ProtectedRoute)
   * should wait for this before making routing decisions.
   */
  _hasHydrated: boolean;

  // ─── Auth ──────────────────────────────────────────────────────────────────
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;

  // ─── Email verification ────────────────────────────────────────────────────
  sendVerification: () => Promise<void>;

  // ─── Password reset ────────────────────────────────────────────────────────
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      // ─── Login ───────────────────────────────────────────────────────────────
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login({ email, password });
          const { user, token } = res.data.data!;
          set({ user, token, isLoading: false });
        } catch (err: unknown) {
          const message = extractMessage(err, 'Login failed');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      // ─── Register ────────────────────────────────────────────────────────────
      register: async (name, email, password, role) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.register({ name, email, password, role });
          const { user, token } = res.data.data!;
          // Store token so user can call send-verification immediately after
          set({ user, token, isLoading: false });
        } catch (err: unknown) {
          const message = extractMessage(err, 'Registration failed');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      // ─── Logout ──────────────────────────────────────────────────────────────
      logout: () => {
        set({ user: null, token: null, error: null });
      },

      clearError: () => set({ error: null }),

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // ─── Email verification ───────────────────────────────────────────────────
      sendVerification: async () => {
        set({ isLoading: true, error: null });
        try {
          await authApi.sendVerification();
          set({ isLoading: false });
        } catch (err: unknown) {
          const message = extractMessage(err, 'Failed to send verification email');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      // ─── Password reset ───────────────────────────────────────────────────────
      forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.forgotPassword(email);
          set({ isLoading: false });
        } catch (err: unknown) {
          const message = extractMessage(err, 'Failed to send reset email');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      resetPassword: async (token, password) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.resetPassword(token, password);
          set({ isLoading: false });
        } catch (err: unknown) {
          const message = extractMessage(err, 'Failed to reset password');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },
    }),
    {
      name: 'agroloop_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
