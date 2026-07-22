import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '../../stores/notification.store';
import { formatDate } from '../../utils/helpers';

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead, deleteNotification } =
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 glass-card border border-slate-700/50 shadow-2xl z-50 animate-slide-up overflow-hidden">
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
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => !n.isRead && markRead(n._id)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-700/20 ${!n.isRead ? 'bg-emerald-500/5' : ''}`}
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-emerald-400' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{n.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-slate-600 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                    className="p-1 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
