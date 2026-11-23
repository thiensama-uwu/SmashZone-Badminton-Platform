import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

/**
 * PrivateRoute — chỉ cho phép truy cập nếu đã xác thực.
 * Nếu chưa login → redirect /auth/login kèm `from` state.
 * Nếu có `requiredRoles` → check role, nếu sai → redirect /unauthorized.
 */
export default function PrivateRoute({ children, requiredRoles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-[3px] border-primary-container/30 border-t-primary-container animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location, originalState: location.state }} replace />;
  }

  if (requiredRoles.length > 0) {
    const userRoles = user.roles || [];
    const hasRole = requiredRoles.some(r => userRoles.includes(r));
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
