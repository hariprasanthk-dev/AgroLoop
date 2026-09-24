import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck, ChevronRight } from 'lucide-react';
import { useNotificationStore } from '../../stores/notification.store';
import { useAuthStore } from '../../stores/auth.store';
import { formatDate } from '../../utils/helpers';
import { ordersPathFor } from '../../constants/orderStatus';
import type { Notification } from '../../types';

/** Notification types whose relatedId is an order. */
const ORDER_TYPES: Notification['type'][] = [
  'order_placed', 'order_accepted', 'order_packaged', 'order_packed', 'order_shipped',
  'order_delivered', 'order_rejected', 'order_cancelled', 'payment_success', 'payment_failed',
];

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { notifications, unreadCount, error, fetchNotifications, markRead, markAllRead, deleteNotification } =
    useNotificationStore();

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const targetFor = (n: Notification): string | null => {
    if (!n.relatedId || !role || !ORDER_TYPES.includes(n.type)) return null;
    const base = ordersPathFor(role);
    return base ? `${base}/${n.relatedId}` : null;
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead(n._id);
    const target = targetFor(n);
    if (target) {
      setOpen(false);
      navigate(target);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] glass-card border border-slate-700/50 shadow-2xl z-50 animate-slide-up overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <span className="font-semibold text-slate-200 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {error && notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm">
                <p className="text-red-300">{error}</p>
                <button onClick={fetchNotifications} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">Retry</button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => {
                const target = targetFor(n);
                return (
                  <div
                    key={n._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleClick(n); }}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-700/20 ${!n.isRead ? 'bg-emerald-500/5' : ''}`}
                  >
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-emerald-400' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        {formatDate(n.createdAt)}
                        {target && <span className="text-emerald-500/80 flex items-center">· View order <ChevronRight className="w-3 h-3" /></span>}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                      aria-label="Delete notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
