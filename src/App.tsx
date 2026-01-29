import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { CarModelsProvider } from "@/contexts/CarModelsContext";
import { lazy, Suspense } from "react";
import Rezerwacje from "./pages/Rezerwacje";
import MojaRezerwacja from "./pages/MojaRezerwacja";
import InstanceAuth from "./pages/InstanceAuth";
import SuperAdminAuth from "./pages/SuperAdminAuth";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import HallView from "./pages/HallView";
import PublicOfferView from "./pages/PublicOfferView";
import PublicProtocolView from "./pages/PublicProtocolView";
import EmbedLeadForm from "./pages/EmbedLeadForm";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedRedirect from "./components/RoleBasedRedirect";

// Lazy loaded pages
const ReminderTemplateEditPage = lazy(() => import("./pages/ReminderTemplateEditPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minut
      retry: 1,
    },
  },
});

// Helper function to detect subdomain from hostname
// New structure:
// - armcar.n2wash.com → public calendar
// - armcar.admin.n2wash.com → admin panel
// - super.admin.n2wash.com → super admin panel
const getSubdomainInfo = () => {
  const hostname = window.location.hostname;
  
  console.log('[Subdomain Detection] hostname:', hostname);
  
  // Local development - no subdomain detection
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[Subdomain Detection] → dev mode');
    return { type: 'dev', subdomain: null };
  }
  
  // Check for n2wash.com domain
  if (hostname.endsWith('.n2wash.com')) {
    const subdomain = hostname.replace('.n2wash.com', '');
    console.log('[Subdomain Detection] subdomain extracted:', subdomain);
    
    // Super admin subdomain: super.admin.n2wash.com
    if (subdomain === 'super.admin') {
      console.log('[Subdomain Detection] → super_admin mode');
      return { type: 'super_admin', subdomain: 'super.admin' };
    }
    
    // Instance admin subdomain: armcar.admin.n2wash.com
    if (subdomain.endsWith('.admin')) {
      const instanceSlug = subdomain.replace('.admin', '');
      console.log('[Subdomain Detection] → instance_admin mode:', instanceSlug);
      return { type: 'instance_admin', subdomain: instanceSlug };
    }
    
    // Instance public subdomain: armcar.n2wash.com
    console.log('[Subdomain Detection] → instance_public mode:', subdomain);
    return { type: 'instance_public', subdomain };
  }
  
  // Lovable staging domain - treat as dev
  if (hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com')) {
    console.log('[Subdomain Detection] → dev mode (lovable staging)');
    return { type: 'dev', subdomain: null };
  }
  
  // Default - unknown domain
  console.log('[Subdomain Detection] → unknown domain');
  return { type: 'unknown', subdomain: null };
};

// Super Admin Routes Component
const SuperAdminRoutes = () => (
  <Routes>
    <Route path="/login" element={<SuperAdminAuth />} />
    <Route 
      path="/" 
      element={
        <ProtectedRoute requiredRole="super_admin">
          <SuperAdminDashboard />
        </ProtectedRoute>
      } 
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

// Instance Public Routes - for armcar.n2wash.com (public calendar only)
const InstancePublicRoutes = ({ subdomain }: { subdomain: string }) => (
  <Routes>
    <Route path="/" element={<Rezerwacje instanceSubdomain={subdomain} />} />
    <Route path="/res" element={<MojaRezerwacja />} />
    <Route path="/moja-rezerwacja" element={<Navigate to="/res" replace />} />
    <Route path="/offers/:token" element={<PublicOfferView />} />
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    <Route path="/embed" element={<EmbedLeadForm />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

// Instance Admin Routes - for armcar.admin.n2wash.com (admin panel)
const InstanceAdminRoutes = ({ subdomain }: { subdomain: string }) => (
  <Routes>
    {/* Login page */}
    <Route path="/login" element={<InstanceAuth subdomainSlug={subdomain} />} />
    
    {/* Role-based redirect after login */}
    <Route path="/dashboard" element={<RoleBasedRedirect />} />
    
    {/* Protected admin routes */}
    <Route 
      path="/" 
      element={<RoleBasedRedirect />} 
    />
    <Route 
      path="/admin" 
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/hall/:hallId" 
      element={
        <ProtectedRoute requiredRole="admin">
          <HallView />
        </ProtectedRoute>
      } 
    />
    {/* All dashboard views - admin gets full access, hall gets limited views */}
    <Route
      path="/:view" 
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } 
    />
    
    {/* Public offer view - works on admin subdomain too */}
    <Route path="/offers/:token" element={<PublicOfferView />} />
    
    {/* Public protocol view - works on admin subdomain too */}
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

// Loading fallback for lazy loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Development Routes - full access for local testing
const DevRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/rezerwacje" replace />} />
    <Route path="/rezerwacje" element={<Rezerwacje />} />
    <Route path="/res" element={<MojaRezerwacja />} />
    <Route path="/moja-rezerwacja" element={<Navigate to="/res" replace />} />
    <Route path="/offers/:token" element={<PublicOfferView />} />
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    {/* Instance-specific login route */}
    <Route path="/:slug/login" element={<InstanceAuth />} />
    {/* Default login without slug - use demo instance for dev */}
    <Route path="/login" element={<InstanceAuth subdomainSlug="demo" />} />
    {/* Role-based redirect after login */}
    <Route path="/dashboard" element={<RoleBasedRedirect />} />
    <Route 
      path="/admin" 
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/admin/hall/:hallId" 
      element={
        <ProtectedRoute requiredRole="admin">
          <HallView />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/admin/halls/:hallId" 
      element={
        <ProtectedRoute requiredRole="admin">
          <HallView />
        </ProtectedRoute>
      } 
    />
    {/* Reminder template edit route - must be before /admin/:view to avoid conflict */}
    <Route 
      path="/admin/reminders/:shortId" 
      element={
        <ProtectedRoute requiredRole="admin">
          <Suspense fallback={<PageLoader />}>
            <ReminderTemplateEditPage />
          </Suspense>
        </ProtectedRoute>
      } 
    />
    <Route
      path="/admin/:view" 
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/super-admin" 
      element={
        <ProtectedRoute requiredRole="super_admin">
          <SuperAdminDashboard />
        </ProtectedRoute>
      } 
    />
    {/* Legacy routes - redirect to login */}
    <Route path="/admin/login" element={<InstanceAuth />} />
    <Route path="/super-admin/login" element={<SuperAdminAuth />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  const subdomainInfo = getSubdomainInfo();

  const renderRoutes = () => {
    switch (subdomainInfo.type) {
      case 'super_admin':
        return <SuperAdminRoutes />;
      case 'instance_admin':
        return <InstanceAdminRoutes subdomain={subdomainInfo.subdomain!} />;
      case 'instance_public':
        return <InstancePublicRoutes subdomain={subdomainInfo.subdomain!} />;
      case 'dev':
      default:
        return <DevRoutes />;
    }
  };

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CarModelsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                {renderRoutes()}
              </BrowserRouter>
            </TooltipProvider>
          </CarModelsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
