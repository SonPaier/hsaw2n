import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'super_admin' | 'admin' | 'user';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  requiredInstanceId?: string;
}

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
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (requiredRole) {
    if (requiredInstanceId) {
      if (!hasInstanceRole(requiredRole, requiredInstanceId) && !hasRole('super_admin')) {
        return <Navigate to="/" replace />;
      }
    } else {
      if (!hasRole(requiredRole)) {
        return <Navigate to="/" replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
