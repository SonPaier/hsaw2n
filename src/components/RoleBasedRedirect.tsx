import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Redirects users based on their role:
 * - hall role → /hall/1 (kiosk mode)
 * - admin/employee → /admin (dashboard)
 * - super_admin → /super-admin
 * - no role → /login
 */
const RoleBasedRedirect = () => {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check for hall role first (kiosk mode)
  const hasHallRole = roles.some(r => r.role === 'hall');
  if (hasHallRole) {
    return <Navigate to="/hall/1" replace />;
  }

  // Check for super_admin
  const isSuperAdmin = roles.some(r => r.role === 'super_admin');
  if (isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  // Check for admin or employee
  const hasAdminAccess = roles.some(r => r.role === 'admin' || r.role === 'employee');
  if (hasAdminAccess) {
    return <Navigate to="/admin" replace />;
  }

  // Fallback - no recognized role
  return <Navigate to="/login" replace />;
};

export default RoleBasedRedirect;
