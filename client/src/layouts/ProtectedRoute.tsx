import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '../types';
import { useAuthStore } from '../stores/auth.store';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, token, _hasHydrated } = useAuthStore();

  // Wait for Zustand persist middleware to finish rehydrating from localStorage
  // before making any auth-based routing decisions. Without this check, the store
  // is momentarily null on hard refresh, causing a spurious redirect to /login.
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!token || !user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    const dashMap: Record<UserRole, string> = {
      admin: '/admin',
      client: '/client',
      farmer: '/farmer',
    };
    return <Navigate to={dashMap[user.role]} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
