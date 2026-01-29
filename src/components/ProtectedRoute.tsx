import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'super_admin' | 'admin' | 'user' | 'employee' | 'hall';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  requiredInstanceId?: string;
}

// Helper to detect login path based on subdomain
// All environments now use /login
const getLoginPath = (): string => {
  return '/login';
};

const ProtectedRoute = ({ children, requiredRole, requiredInstanceId }: ProtectedRouteProps) => {
  const { user, loading, hasRole, hasInstanceRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const loginPath = getLoginPath();
    return <Navigate to={`${loginPath}?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (requiredRole) {
    if (requiredInstanceId) {
      if (!hasInstanceRole(requiredRole, requiredInstanceId) && !hasRole('super_admin')) {
        return <Navigate to="/" replace />;
      }
    } else {
      // For admin role, also allow employee and hall roles (they have limited access)
      if (requiredRole === 'admin') {
        const hasAccess = hasRole('admin') || hasRole('super_admin') || hasRole('employee') || hasRole('hall');
        if (!hasAccess) {
          return <Navigate to="/" replace />;
        }
      } else if (!hasRole(requiredRole)) {
        return <Navigate to="/" replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
