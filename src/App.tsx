import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import Rezerwacje from "./pages/Rezerwacje";
import MojaRezerwacja from "./pages/MojaRezerwacja";
import Auth from "./pages/Auth";
import InstanceAuth from "./pages/InstanceAuth";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import HallView from "./pages/HallView";
import PublicOfferView from "./pages/PublicOfferView";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import IOSInstallPrompt from "./components/pwa/IOSInstallPrompt";

const queryClient = new QueryClient();

// Helper function to detect subdomain from hostname
const getSubdomainInfo = () => {
  const hostname = window.location.hostname;
  
  // Debug logging
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
    
    // Super admin subdomain
    if (subdomain === 'super.admin') {
      console.log('[Subdomain Detection] → super_admin mode');
      return { type: 'super_admin', subdomain: 'super.admin' };
    }
    
    // Instance subdomain (e.g., armcar, demo)
    console.log('[Subdomain Detection] → instance mode:', subdomain);
    return { type: 'instance', subdomain };
  }
  
  // Lovable staging domain - treat as dev
  if (hostname.endsWith('.lovable.app')) {
    console.log('[Subdomain Detection] → dev mode (lovable.app)');
    return { type: 'dev', subdomain: null };
  }
  
  // Default - unknown domain
  console.log('[Subdomain Detection] → unknown domain');
  return { type: 'unknown', subdomain: null };
};

// Super Admin Routes Component
const SuperAdminRoutes = () => (
  <Routes>
    <Route 
      path="/" 
      element={
        <ProtectedRoute requiredRole="super_admin">
          <SuperAdminDashboard />
        </ProtectedRoute>
      } 
    />
    <Route path="/login" element={<Auth />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

// Instance Routes Component - for xyz.n2wash.com subdomains
const InstanceRoutes = ({ subdomain }: { subdomain: string }) => (
  <Routes>
    {/* Public booking view at root */}
    <Route path="/" element={<Rezerwacje instanceSubdomain={subdomain} />} />
    <Route path="/res" element={<MojaRezerwacja />} />
    <Route path="/moja-rezerwacja" element={<Navigate to="/res" replace />} />
    <Route path="/oferta/:token" element={<PublicOfferView />} />
    
    {/* Admin login - redirects to instance-specific auth */}
    <Route path="/admin/login" element={<InstanceAuth subdomainSlug={subdomain} />} />
    
    {/* Protected admin routes */}
    <Route 
      path="/admin" 
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/admin/hall" 
      element={
        <ProtectedRoute requiredRole="admin">
          <HallView />
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
    
    <Route path="*" element={<NotFound />} />
  </Routes>
);

// Development Routes - full access for local testing
const DevRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/rezerwacje" replace />} />
    <Route path="/rezerwacje" element={<Rezerwacje />} />
    <Route path="/res" element={<MojaRezerwacja />} />
    <Route path="/moja-rezerwacja" element={<Navigate to="/res" replace />} />
    <Route path="/oferta/:token" element={<PublicOfferView />} />
    {/* Instance-specific login route */}
    <Route path="/:slug/login" element={<InstanceAuth />} />
    <Route path="/auth" element={<Auth />} />
    <Route 
      path="/admin" 
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/admin/hall" 
      element={
        <ProtectedRoute requiredRole="admin">
          <HallView />
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
    {/* Legacy routes - redirect to new auth */}
    <Route path="/admin/login" element={<Auth />} />
    <Route path="/super-admin/login" element={<Auth />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  const subdomainInfo = getSubdomainInfo();

  const renderRoutes = () => {
    switch (subdomainInfo.type) {
      case 'super_admin':
        return <SuperAdminRoutes />;
      case 'instance':
        return <InstanceRoutes subdomain={subdomainInfo.subdomain!} />;
      case 'dev':
      default:
        return <DevRoutes />;
    }
  };

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <IOSInstallPrompt />
            <BrowserRouter>
              {renderRoutes()}
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
