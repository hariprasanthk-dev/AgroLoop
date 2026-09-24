/**
 * useSocket – manages a persistent Socket.IO connection for the authenticated user.
 *
 * Socket events are *signals*, never state:
 *  - 'notification:new'  → the notification document the server just saved
 *                          (real _id / relatedId) → add to bell + toast
 *  - 'order:updated'     → { orderId } → re-fetch that order from the API
 *  - 'inventory:refresh' → re-fetch inventory
 * Order and payment status shown in the UI always come from the REST API.
 */
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useOrderStore } from '../stores/order.store';
import { useNotificationStore } from '../stores/notification.store';
import { useInventoryStore } from '../stores/inventory.store';
import { usePaymentStore } from '../stores/payment.store';
import { useAuthStore } from '../stores/auth.store';
import type { Notification } from '../types';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '') : 'http://localhost:5000');

const TOAST_VARIANT: Partial<Record<Notification['type'], 'success' | 'warning' | 'error'>> = {
  payment_success: 'success',
  order_accepted: 'success',
  order_delivered: 'success',
  order_rejected: 'warning',
  order_cancelled: 'warning',
  payment_failed: 'error',
};

export const useSocket = (): void => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    // Avoid double-connect in React Strict Mode
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message);
    });

    socket.on('notification:new', (notification: Notification) => {
      useNotificationStore.getState().addNotification(notification);
      const variant = TOAST_VARIANT[notification.type];
      const show = variant ? toast[variant] : toast.info;
      // Keyed by order + type so a page-level toast for the same event is replaced, not duplicated.
      show(notification.title, {
        description: notification.message,
        id: notification.relatedId ? `${notification.relatedId}:${notification.type}` : notification._id,
      });
    });

    socket.on('order:updated', ({ orderId }: { orderId: string }) => {
      // Re-read from the database-backed API; the event carries no status.
      useOrderStore.getState().refreshOrder(orderId);
      usePaymentStore.getState().refreshPayments();
    });

    socket.on('inventory:refresh', () => {
      const { fetchBatches, lastParams } = useInventoryStore.getState();
      fetchBatches(Object.keys(lastParams).length ? lastParams : { status: 'available', limit: 50 });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);
};
