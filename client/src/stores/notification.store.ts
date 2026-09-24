import { create } from 'zustand';
import type { Notification } from '../types';
import { toast } from 'sonner';
import { notificationApi } from '../api/notification.api';
import { extractMessage } from '../utils/helpers';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

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
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await notificationApi.list({ limit: 20 });
      set({
        notifications: res.data.data?.notifications ?? [],
        unreadCount: res.data.data?.unreadCount ?? 0,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: extractMessage(err, 'Failed to load notifications') });
    }
  },

  markRead: async (id) => {
    try {
      await notificationApi.markRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      toast.error(extractMessage(err, 'Could not mark the notification as read'));
    }
  },

  markAllRead: async () => {
    try {
      await notificationApi.markAllRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      toast.error(extractMessage(err, 'Could not mark notifications as read'));
    }
  },

  deleteNotification: async (id) => {
    try {
      await notificationApi.delete(id);
      set((state) => {
        const removed = state.notifications.find((n) => n._id === id);
        return {
          notifications: state.notifications.filter((n) => n._id !== id),
          unreadCount: removed && !removed.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      });
    } catch (err) {
      toast.error(extractMessage(err, 'Could not delete the notification'));
    }
  },

  // `n` is the notification document persisted by the server (real _id).
  addNotification: (n) => {
    set((state) => {
      if (state.notifications.some((existing) => existing._id === n._id)) return state;
      return {
        notifications: [n, ...state.notifications],
        unreadCount: state.unreadCount + (n.isRead ? 0 : 1),
      };
    });
  },
}));
