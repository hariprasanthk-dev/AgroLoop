/**
 * useSocket – manages a persistent Socket.IO connection for the authenticated user.
 *
 * Responsibilities:
 *  - Connect with JWT from Zustand auth store (single source of truth)
 *  - Join user's private room automatically (server does this on connection)
 *  - Handle 'notification:new'  → add to notification store
 *  - Handle 'order:statusUpdate' → sync order store + show toast
 *  - Handle 'inventory:refresh' → re-fetch inventory store
 *  - Disconnect cleanly on unmount / logout
 */
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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

let toastContainer: HTMLDivElement | null = null;

const showToast = (title: string, message: string, variant: 'success' | 'info' | 'warning' = 'info') => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'socket-toast-container';
    toastContainer.style.cssText = `
      position: fixed; top: 1rem; right: 1rem; z-index: 9999;
      display: flex; flex-direction: column; gap: 0.5rem;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  const colors: Record<string, string> = {
    success: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400',
    info: 'border-blue-500/60 bg-blue-500/10 text-blue-400',
    warning: 'border-amber-500/60 bg-amber-500/10 text-amber-400',
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    pointer-events: auto;
    min-width: 280px; max-width: 360px;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid;
    backdrop-filter: blur(12px);
    background: rgba(15,23,42,0.85);
    animation: slideInRight 0.3s ease;
    transition: opacity 0.4s ease;
  `;
  toast.className = colors[variant] ?? colors.info;
  toast.innerHTML = `
    <p style="font-weight:600;font-size:0.8rem;color:#e2e8f0;margin:0 0 2px;">${title}</p>
    <p style="font-size:0.75rem;color:#94a3b8;margin:0;">${message}</p>
  `;

  // Inject keyframe once
  if (!document.getElementById('socket-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'socket-toast-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(110%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
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
      showToast(payload.title, payload.message, 'info');
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

      showToast(
        `Order ${payload.newStatus.charAt(0).toUpperCase() + payload.newStatus.slice(1)}`,
        payload.message ?? `Your order status changed to ${payload.newStatus}`,
        statusVariant[payload.newStatus] ?? 'info'
      );
    });

    // ── Payment success event (for client) ──────────────────────────────────────
    socket.on('payment:success', (payload: { orderId: string; amount: number; paymentId: string }) => {
      updateOrderPaymentStatusInList(payload.orderId, 'paid');
      updatePaymentStatus(payload.orderId, 'paid');
      showToast(
        'Payment Successful 🎉',
        `Payment of ₹${payload.amount.toLocaleString('en-IN')} has been verified.`,
        'success'
      );
    });

    // ── Inventory refresh (for everyone after stock changes) ────────────────────
    socket.on('inventory:refresh', () => {
      const { fetchBatches, lastParams } = useInventoryStore.getState();
      // Re-fetch with whatever params the current page is using (or default available)
      fetchBatches(Object.keys(lastParams).length ? lastParams : { status: 'available', limit: 50 });
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // The empty dependency array is intentional: the socket connection is established
  // once on mount and torn down on unmount (like componentDidMount/WillUnmount).
  // All store callbacks are accessed via .getState() — outside React's reactive
  // system — so they do not need to be listed as dependencies.
  // eslint-disable comments are not needed here; the rule does not apply.
  }, []);
};
