import { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Car, Calendar, LogOut, Menu, Settings, UserCircle, 
  PanelLeftClose, PanelLeft, FileText, Package, X, CalendarClock, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useInstanceFeatures } from '@/hooks/useInstanceFeatures';
import { supabase } from '@/integrations/supabase/client';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const AdminLayout = ({ children, title }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    return saved === 'true';
  });
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const { hasFeature } = useInstanceFeatures(instanceId);

  useEffect(() => {
    const fetchUserInstanceId = async () => {
      if (!user) return;
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('instance_id, role')
        .eq('user_id', user.id);
      
      if (!rolesData || rolesData.length === 0) return;
      const adminRole = rolesData.find(r => r.role === 'admin' && r.instance_id);
      if (adminRole?.instance_id) {
        setInstanceId(adminRole.instance_id);
        return;
      }
      const isSuperAdmin = rolesData.some(r => r.role === 'super_admin');
      if (isSuperAdmin) {
        const { data: instances } = await supabase
          .from('instances')
          .select('id')
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (instances?.id) {
          setInstanceId(instances.id);
        }
      }
    };
    fetchUserInstanceId();
  }, [user]);

  // Fetch pending reservations count
  useEffect(() => {
    if (!instanceId) return;
    
    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
        .eq('status', 'pending');
      
      setPendingCount(count || 0);
    };

    fetchPendingCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('pending-reservations-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `instance_id=eq.${instanceId}`
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || 
             location.pathname === '/admin/calendar';
    }
    if (path === '/admin/reservations') {
      return location.pathname === '/admin/reservations';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/admin', icon: Calendar, label: 'Kalendarz' },
    { path: '/admin/reservations', icon: ClipboardList, label: 'Rezerwacje', badge: pendingCount > 0 ? pendingCount : undefined },
    { path: '/admin/customers', icon: UserCircle, label: 'Klienci' },
    ...(hasFeature('offers') ? [{ path: '/admin/oferty', icon: FileText, label: 'Oferty' }] : []),
    ...(hasFeature('offers') ? [{ path: '/admin/produkty', icon: Package, label: 'Produkty' }] : []),
    ...(hasFeature('followup') ? [{ path: '/admin/followup', icon: CalendarClock, label: 'Follow-up' }] : []),
    { path: '/admin/settings', icon: Settings, label: 'Ustawienia' },
  ];

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 h-screen glass-card border-r border-border/50 flex flex-col transition-all duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarCollapsed ? "lg:w-16" : "lg:w-64",
        "w-64"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={cn(
            "flex items-center gap-3 border-b border-border/50",
            sidebarCollapsed ? "p-4 justify-center" : "p-6"
          )}>
            <Car className="w-8 h-8 text-primary shrink-0" />
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg text-foreground">ARM CAR</h1>
                <p className="text-xs text-muted-foreground">Auto Detailing</p>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden ml-auto"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className={cn("flex-1 space-y-1", sidebarCollapsed ? "p-2" : "p-4")}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'secondary' : 'ghost'}
                className={cn(
                  "w-full gap-3 relative",
                  sidebarCollapsed ? "justify-center px-2" : "justify-start"
                )}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                title={item.label}
              >
                <div className="relative">
                  <item.icon className="w-4 h-4 shrink-0" />
                  {sidebarCollapsed && item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="min-w-[20px] h-5 px-1.5 text-xs font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Button>
            ))}
          </nav>

          {/* Footer */}
          <div className={cn(
            "border-t border-border/50 space-y-2",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            <Button
              variant="ghost"
              className={cn(
                "w-full text-muted-foreground hidden lg:flex gap-3",
                sidebarCollapsed ? "justify-center px-2" : "justify-start"
              )}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Rozwiń menu" : "Zwiń menu"}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-4 h-4 shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 shrink-0" />
                  Zwiń menu
                </>
              )}
            </Button>
            
            {!sidebarCollapsed && user && (
              <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                {user.email}
              </div>
            )}
            <Button
              variant="ghost"
              className={cn(
                "w-full text-muted-foreground gap-3",
                sidebarCollapsed ? "justify-center px-2" : "justify-start"
              )}
              onClick={handleLogout}
              title="Wyloguj się"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && "Wyloguj się"}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 glass-card border-b border-border/50 p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              <span className="font-bold">{title || 'ARM CAR'}</span>
            </div>
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
