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
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import HallView from "./pages/HallView";
import OffersPage from "./pages/OffersPage";
import ProductsPage from "./pages/ProductsPage";
import PublicOfferView from "./pages/PublicOfferView";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import IOSInstallPrompt from "./components/pwa/IOSInstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <IOSInstallPrompt />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/rezerwacje" replace />} />
              <Route path="/rezerwacje" element={<Rezerwacje />} />
              <Route path="/moja-rezerwacja" element={<MojaRezerwacja />} />
              <Route path="/oferta/:token" element={<PublicOfferView />} />
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
                path="/admin/oferty" 
                element={
                  <ProtectedRoute requiredRole="admin">
                    <OffersPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/produkty" 
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ProductsPage />
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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
