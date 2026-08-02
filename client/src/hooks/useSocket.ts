/**
 * useSocket – manages a persistent Socket.IO connection for the authenticated user.
 *
 * Responsibilities:
 *  - Connect with JWT from Zustand auth store (single source of truth)
 *  - Join user's private room automatically (server does this on connection)
 *  - Handle 'notification:new'  → add to notification store + show toast
 *  - Handle 'order:statusUpdate' → sync order store + show toast
 *  - Handle 'inventory:refresh' → re-fetch inventory store
 *  - Disconnect cleanly on unmount / logout
 */
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useOrderStore } from '../stores/order.store';
import { useNotificationStore } from '../stores/notification.store';
import { useInventoryStore } from '../stores/inventory.store';
import { usePaymentStore } from '../stores/payment.store';
import { useAuthStore } from '../stores/auth.store';
import type { OrderStatus, Notification } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

interface OrderStatusUpdate {
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  message?: string;
}

interface IncomingNotification {
  title: string;
  message: string;
  type: string;
  orderId?: string;
}

const showNotificationToast = (
  title: string,
  message: string,
  variant: 'success' | 'info' | 'warning' = 'info'
) => {
  if (variant === 'success') {
    toast.success(title, { description: message });
  } else if (variant === 'warning') {
    toast.warning(title, { description: message });
  } else {
    toast.info(title, { description: message });
  }
};

export const useSocket = (): void => {
  const socketRef = useRef<Socket | null>(null);
  const { updateOrderInList, updateOrderPaymentStatusInList } = useOrderStore.getState();
  const { addNotification } = useNotificationStore.getState();
  const { updatePaymentStatus } = usePaymentStore.getState();

  useEffect(() => {
    // Read token from Zustand (single source of truth) instead of localStorage directly.
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

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connect error:', err.message);
    });

    // ── Incoming notification (for farmer: new order received) ─────────────────
    socket.on('notification:new', (payload: IncomingNotification) => {
      const n: Notification = {
        _id: `socket-${Date.now()}`,
        userId: '',
        title: payload.title,
        message: payload.message,
        type: payload.type as Notification['type'],
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      addNotification(n);
      showNotificationToast(payload.title, payload.message, 'info');
    });

    // ── Order status update (for client) ────────────────────────────────────────
    socket.on('order:statusUpdate', (payload: OrderStatusUpdate) => {
      updateOrderInList(payload.orderId, payload.newStatus);

      const statusVariant: Record<string, 'success' | 'info' | 'warning'> = {
        accepted: 'success',
        packed: 'info',
        shipped: 'info',
        delivered: 'success',
        cancelled: 'warning',
      };

      showNotificationToast(
        `Order ${payload.newStatus.charAt(0).toUpperCase() + payload.newStatus.slice(1)}`,
        payload.message ?? `Your order status changed to ${payload.newStatus}`,
        statusVariant[payload.newStatus] ?? 'info'
      );
    });

    // ── Payment success event (for client) ──────────────────────────────────────
    socket.on('payment:success', (payload: { orderId: string; amount: number; paymentId: string }) => {
      updateOrderPaymentStatusInList(payload.orderId, 'paid');
      updatePaymentStatus(payload.orderId, 'paid');
      showNotificationToast(
        'Payment Successful 🎉',
        `Payment of ₹${payload.amount.toLocaleString('en-IN')} has been verified.`,
        'success'
      );
    });

    // ── Inventory refresh (for everyone after stock changes) ────────────────────
    socket.on('inventory:refresh', () => {
      const { fetchBatches, lastParams } = useInventoryStore.getState();
      fetchBatches(Object.keys(lastParams).length ? lastParams : { status: 'available', limit: 50 });
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);
};
