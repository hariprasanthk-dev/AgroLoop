import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';
import { useSocket } from '../hooks/useSocket';

const titleMap: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/inventory': 'Inventory Management',
  '/admin/orders': 'Order Management',
  '/admin/users': 'User Management',
  '/client': 'Dashboard',
  '/client/browse': 'Browse Inventory',
  '/client/orders': 'My Orders',
  '/client/payments': 'Payment History',
  '/farmer': 'Dashboard',
  '/farmer/inventory': 'My Inventory',
  '/farmer/orders': 'Orders',
};

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = titleMap[pathname] ?? 'AgroLoop';

  // Initialise Socket.IO for real-time order & inventory updates
  useSocket();

  // Close sidebar automatically on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Responsive Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content container */}
      <div className="flex-1 lg:ml-64 ml-0 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
        <Topbar title={title} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
