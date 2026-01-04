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

// Helper to detect login path based on subdomain
// New structure:
// - armcar.admin.n2wash.com → /login
// - super.admin.n2wash.com → /login  
// - localhost/lovable.app → /auth
const getSubdomainLoginPath = (): string => {
  const hostname = window.location.hostname;
  
  // Local development or lovable staging
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.lovable.app')) {
    return '/auth';
  }
  
  // Super admin subdomain or instance admin subdomain
  if (hostname === 'super.admin.n2wash.com' || hostname.endsWith('.admin.n2wash.com')) {
    return '/login';
  }
  
  return '/auth';
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
    const loginPath = getSubdomainLoginPath();
    return <Navigate to={`${loginPath}?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (requiredRole) {
    if (requiredInstanceId) {
      if (!hasInstanceRole(requiredRole, requiredInstanceId) && !hasRole('super_admin')) {
        return <Navigate to="/" replace />;
      }
    } else {
      // For admin role, also allow employee role (they have limited access but can see calendar)
      if (requiredRole === 'admin') {
        const hasAccess = hasRole('admin') || hasRole('super_admin') || hasRole('employee');
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
