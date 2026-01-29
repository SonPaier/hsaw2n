import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Redirects authenticated users based on their role:
 * - hall role → /halls (halls list in AdminDashboard)
 * - admin/employee → /admin (dashboard)
 * - super_admin → /super-admin
 * - unauthenticated → /login
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

  // Check for hall role first - redirect to specific hall calendar
  const hallRole = roles.find(r => r.role === 'hall');
  if (hallRole) {
    // If hall_id is assigned, redirect to that specific hall
    if (hallRole.hall_id) {
      return <Navigate to={`/halls/${hallRole.hall_id}`} replace />;
    }
    // Fallback: first active hall
    return <Navigate to="/halls/1" replace />;
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
