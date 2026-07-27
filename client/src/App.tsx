import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './layouts/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoadingSpinner from './components/common/LoadingSpinner';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each page bundle is only downloaded when the user first navigates to that route,
// reducing the initial JS payload for all roles.

// Auth
const Login    = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminOrders    = lazy(() => import('./pages/admin/AdminOrders'));
const AdminUsers     = lazy(() => import('./pages/admin/AdminUsers'));

// Client
const ClientDashboard  = lazy(() => import('./pages/client/ClientDashboard'));
const BrowseInventory  = lazy(() => import('./pages/client/BrowseInventory'));
const ClientOrders     = lazy(() => import('./pages/client/ClientOrders'));
const PaymentHistory   = lazy(() => import('./pages/client/PaymentHistory'));

// Farmer
const FarmerDashboard  = lazy(() => import('./pages/farmer/FarmerDashboard'));
const FarmerInventory  = lazy(() => import('./pages/farmer/FarmerInventory'));
const FarmerOrders     = lazy(() => import('./pages/farmer/FarmerOrders'));

// ─── Route-level Suspense fallback ───────────────────────────────────────────
const PageFallback = (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
);

const App: React.FC = () => (
  <BrowserRouter>
    <Suspense fallback={PageFallback}>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/"         element={<Navigate to="/login" replace />} />

        {/* Admin */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin"           element={<AdminDashboard />} />
            <Route path="/admin/inventory" element={<AdminInventory />} />
            <Route path="/admin/orders"    element={<AdminOrders />} />
            <Route path="/admin/users"     element={<AdminUsers />} />
          </Route>
        </Route>

        {/* Client */}
        <Route element={<ProtectedRoute allowedRoles={['client']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/client"          element={<ClientDashboard />} />
            <Route path="/client/browse"   element={<BrowseInventory />} />
            <Route path="/client/orders"   element={<ClientOrders />} />
            <Route path="/client/payments" element={<PaymentHistory />} />
          </Route>
        </Route>

        {/* Farmer */}
        <Route element={<ProtectedRoute allowedRoles={['farmer']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/farmer"           element={<FarmerDashboard />} />
            <Route path="/farmer/inventory" element={<FarmerInventory />} />
            <Route path="/farmer/orders"    element={<FarmerOrders />} />
          </Route>
        </Route>

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
