import React from 'react';
import { Menu } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useAuthStore } from '../../stores/auth.store';

interface TopbarProps {
  title: string;
  onMenuClick?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ title, onMenuClick }) => {
  const { user } = useAuthStore();
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-700/50 bg-dark-800/60 backdrop-blur-lg sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button onClick={onMenuClick} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 lg:hidden">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-base font-bold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-500 hidden sm:block">{greeting}, {user?.name?.split(' ')[0]} 👋</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2 ml-2 px-3 py-1.5 rounded-xl bg-slate-700/40 border border-slate-600/40">
          <span className="text-xs font-medium text-slate-300 capitalize">{user?.role}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
