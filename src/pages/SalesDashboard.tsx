import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ShoppingCart,
  Users,
  Package,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeft,
  ChevronUp,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

type SalesViewType = 'orders' | 'customers' | 'products';

const validViews: SalesViewType[] = ['orders', 'customers', 'products'];

const SalesDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { view } = useParams<{ view?: string }>();
  const { user, roles, username: authUsername, signOut, hasRole } = useAuth();

  const currentView: SalesViewType =
    view && validViews.includes(view as SalesViewType)
      ? (view as SalesViewType)
      : 'orders';

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sales-sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sales-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Determine base path: subdomain vs dev mode
  const basePath = location.pathname.startsWith('/admin/sales-crm')
    ? '/admin/sales-crm'
    : '/sales-crm';

  // Studio base path for "switch to studio" link
  const studioBasePath = location.pathname.startsWith('/admin') ? '/admin' : '/';

  const setCurrentView = (newView: SalesViewType) => {
    const target = newView === 'orders' ? basePath : `${basePath}/${newView}`;
    navigate(target, { replace: true });
    setSidebarOpen(false);
  };

  const hasStudioAccess = hasRole('admin') || hasRole('employee') || hasRole('super_admin');

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Get instance_id from roles
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;

  const navItems: { key: SalesViewType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'orders', label: 'Zamówienia', icon: ShoppingCart },
    { key: 'customers', label: 'Klienci', icon: Users },
    { key: 'products', label: 'Produkty', icon: Package },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'orders':
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <ShoppingCart className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-lg font-medium">Zamówienia</p>
              <p className="text-sm">Moduł w przygotowaniu</p>
            </div>
          </div>
        );
      case 'customers':
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <Users className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-lg font-medium">Klienci</p>
              <p className="text-sm">Moduł w przygotowaniu</p>
            </div>
          </div>
        );
      case 'products':
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <Package className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-lg font-medium">Produkty</p>
              <p className="text-sm">Moduł w przygotowaniu</p>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <Helmet>
        <title>Panel Sprzedaży</title>
      </Helmet>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300 lg:relative',
            sidebarCollapsed ? 'w-14' : 'w-60',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Logo / header */}
          <div className={cn('flex items-center border-b border-border', sidebarCollapsed ? 'p-2 justify-center' : 'p-4')}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ShoppingCart className="w-5 h-5 text-primary shrink-0" />
                <span className="font-semibold text-sm truncate">Panel Sprzedaży</span>
              </div>
            )}
            {sidebarCollapsed && <ShoppingCart className="w-5 h-5 text-primary" />}
            {/* Mobile close */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className={cn('flex-1 overflow-y-auto', sidebarCollapsed ? 'p-1 space-y-1' : 'p-3 space-y-1')}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.key}
                  variant={currentView === item.key ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full gap-3',
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
                  )}
                  onClick={() => setCurrentView(item.key)}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && item.label}
                </Button>
              );
            })}

            {/* Switch to Studio */}
            {hasStudioAccess && (
              <>
                <Separator className="my-3" />
                <Button
                  variant="outline"
                  className={cn(
                    'w-full gap-3',
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
                  )}
                  onClick={() => navigate(studioBasePath)}
                  title="Przejdź do Panelu Studio"
                >
                  <ArrowLeftRight className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && 'Panel Studio'}
                </Button>
              </>
            )}
          </nav>

          {/* Footer: collapse + user */}
          <div className={cn(sidebarCollapsed ? 'p-2 space-y-2' : 'p-4 space-y-3')}>
            <Button
              variant="ghost"
              className={cn(
                'w-full text-muted-foreground hidden lg:flex gap-3',
                sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
              )}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Rozwiń menu' : 'Zwiń menu'}
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

            {!sidebarCollapsed && <Separator className="my-3 -mx-4 w-[calc(100%+2rem)] bg-border/30" />}

            {sidebarCollapsed ? (
              <Button
                variant="ghost"
                className="w-full justify-center px-2 text-muted-foreground"
                onClick={handleLogout}
                title="Wyloguj się"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </Button>
            ) : (
              user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between text-muted-foreground px-3 h-auto py-2"
                    >
                      <span className="text-sm truncate">{authUsername || user.email}</span>
                      <ChevronUp className="w-4 h-4 shrink-0 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-56">
                    <DropdownMenuItem onClick={handleLogout} className="gap-2">
                      <LogOut className="w-4 h-4" />
                      Wyloguj się
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center h-14 px-4 border-b border-border bg-card">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <span className="ml-3 font-semibold text-sm">Panel Sprzedaży</span>
          </header>

          {/* Content area */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </>
  );
};

export default SalesDashboard;
