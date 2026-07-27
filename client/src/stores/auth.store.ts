import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../api/auth.api';

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

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login({ email, password });
          const { user, token } = res.data.data!;
          // Token is persisted automatically by Zustand persist middleware.
          // Do NOT write to localStorage manually — Zustand is the single source of truth.
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
          // Token is persisted automatically by Zustand persist middleware.
          set({ user, token, isLoading: false });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Registration failed';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      logout: () => {
        // Zustand persist middleware handles clearing the persisted key on next rehydration.
        set({ user: null, token: null, error: null });
      },

      clearError: () => set({ error: null }),

      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'agroloop_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        // Called by Zustand once rehydration from localStorage is complete.
        // Setting _hasHydrated lets ProtectedRoute know it is safe to check auth state.
        state?.setHasHydrated(true);
      },
    }
  )
);
