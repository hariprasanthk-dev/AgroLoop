import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './layouts/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Auth
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminInventory from './pages/admin/AdminInventory';
import AdminOrders from './pages/admin/AdminOrders';
import AdminUsers from './pages/admin/AdminUsers';

// Client
import ClientDashboard from './pages/client/ClientDashboard';
import BrowseInventory from './pages/client/BrowseInventory';
import ClientOrders from './pages/client/ClientOrders';
import PaymentHistory from './pages/client/PaymentHistory';

// Farmer
import FarmerDashboard from './pages/farmer/FarmerDashboard';
import FarmerInventory from './pages/farmer/FarmerInventory';
import FarmerOrders from './pages/farmer/FarmerOrders';

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Admin */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/inventory" element={<AdminInventory />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Route>

      {/* Client */}
      <Route element={<ProtectedRoute allowedRoles={['client']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/browse" element={<BrowseInventory />} />
          <Route path="/client/orders" element={<ClientOrders />} />
          <Route path="/client/payments" element={<PaymentHistory />} />
        </Route>
      </Route>

      {/* Farmer */}
      <Route element={<ProtectedRoute allowedRoles={['farmer']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/farmer" element={<FarmerDashboard />} />
          <Route path="/farmer/inventory" element={<FarmerInventory />} />
          <Route path="/farmer/orders" element={<FarmerOrders />} />
        </Route>
      </Route>

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
