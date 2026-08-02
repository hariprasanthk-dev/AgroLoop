import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  LogOut, Leaf, BarChart3, CreditCard, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { getInitials } from '../../utils/helpers';
import type { UserRole } from '../../types';

interface NavItem { to: string; icon: React.ReactNode; label: string; }

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const adminNav: NavItem[] = [
  { to: '/admin',           icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard'  },
  { to: '/admin/inventory', icon: <Package className="w-4 h-4" />,         label: 'Inventory'  },
  { to: '/admin/orders',    icon: <ShoppingCart className="w-4 h-4" />,    label: 'Orders'     },
  { to: '/admin/users',     icon: <Users className="w-4 h-4" />,           label: 'Users'      },
];
const clientNav: NavItem[] = [
  { to: '/client',         icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard'       },
  { to: '/client/browse',  icon: <Package className="w-4 h-4" />,         label: 'Browse Inventory' },
  { to: '/client/orders',  icon: <ShoppingCart className="w-4 h-4" />,    label: 'My Orders'       },
  { to: '/client/payments', icon: <CreditCard className="w-4 h-4" />,      label: 'Payments'        },
];
const farmerNav: NavItem[] = [
  { to: '/farmer',           icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard'    },
  { to: '/farmer/inventory', icon: <Leaf className="w-4 h-4" />,            label: 'My Inventory' },
  { to: '/farmer/orders',    icon: <BarChart3 className="w-4 h-4" />,       label: 'Orders'       },
];
const navMap: Record<UserRole, NavItem[]> = { admin: adminNav, client: clientNav, farmer: farmerNav };

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const navItems = user ? (navMap[user.role] ?? []) : [];

  return (
    <aside
      className={`fixed left-0 top-0 h-full w-64 glass-card rounded-none border-r border-slate-700/50 flex flex-col z-40 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Logo & Close Button */}
      <div className="px-6 py-6 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <span className="text-lg">🧅</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-gradient">AgroLoop</h1>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role} Portal</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length === 2}
            onClick={() => onClose?.()}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-full flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
            {user ? getInitials(user.name) : 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => {
            onClose?.();
            logout();
            navigate('/login');
          }}
          className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
