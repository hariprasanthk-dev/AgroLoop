import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '../types';
import { useAuthStore } from '../stores/auth.store';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, token } = useAuthStore();

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
