import React, { useState } from 'react';
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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Topbar title={title} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
