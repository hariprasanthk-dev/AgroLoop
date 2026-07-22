import { create } from 'zustand';
import type { Notification } from '../types';
import { notificationApi } from '../api/notification.api';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addNotification: (n: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await notificationApi.list({ limit: 20 });
      set({
        notifications: res.data.data?.notifications ?? [],
        unreadCount: res.data.data?.unreadCount ?? 0,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (id) => {
    try {
      await notificationApi.markRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {/* silent */}
  },

  markAllRead: async () => {
    try {
      await notificationApi.markAllRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch {/* silent */}
  },

  deleteNotification: async (id) => {
    try {
      await notificationApi.delete(id);
      set((state) => ({ notifications: state.notifications.filter((n) => n._id !== id) }));
    } catch {/* silent */}
  },

  addNotification: (n) => {
    set((state) => ({
      notifications: [n, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
