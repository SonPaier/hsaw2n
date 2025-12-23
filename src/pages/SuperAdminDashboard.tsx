import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Shield, Building2, Users, Settings, LogOut, 
  Menu, Eye, Power, MoreVertical, Plus, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const mockInstances = [
  {
    id: 'inst1',
    name: 'ARM CAR AUTO SPA GDAŃSK',
    active: true,
    admins: 2,
    reservationsToday: 8,
    createdAt: '2025-01-01',
  },
  {
    id: 'inst2',
    name: 'CLEAN CAR Warszawa',
    active: true,
    admins: 1,
    reservationsToday: 12,
    createdAt: '2025-02-15',
  },
  {
    id: 'inst3',
    name: 'AUTO DETAILING Kraków',
    active: false,
    admins: 1,
    reservationsToday: 0,
    createdAt: '2025-03-10',
  },
];

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    navigate('/super-admin/login');
  };

  const handleSeeAsClient = (instanceId: string, instanceName: string) => {
    toast.info(`Otwieranie widoku klienta: ${instanceName}`);
    // In production, this would navigate to the specific instance in debug mode
  };

  const handleToggleInstance = (instanceId: string, currentState: boolean) => {
    toast.success(`Instancja ${currentState ? 'wyłączona' : 'włączona'}`);
  };

  return (
    <>
      <Helmet>
        <title>Super Admin - Panel zarządzania</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-purple-500/20 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-foreground">Super Admin</h1>
                  <p className="text-xs text-muted-foreground">Panel zarządzania</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              <Button variant="secondary" className="w-full justify-start gap-3">
                <Building2 className="w-4 h-4" />
                Instancje
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Users className="w-4 h-4" />
                Administratorzy
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Settings className="w-4 h-4" />
                Ustawienia
              </Button>
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-purple-500/20">
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Wyloguj się
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 glass-card border-b border-purple-500/20 p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <span className="font-bold">Super Admin</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-4 lg:p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Instancje</h1>
                <p className="text-muted-foreground">
                  Zarządzaj wszystkimi instancjami aplikacji
                </p>
              </div>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white gap-2">
                <Plus className="w-4 h-4" />
                Nowa instancja
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-foreground">{mockInstances.length}</div>
                <div className="text-sm text-muted-foreground">Wszystkie instancje</div>
              </div>
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-success">{mockInstances.filter(i => i.active).length}</div>
                <div className="text-sm text-muted-foreground">Aktywne</div>
              </div>
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-foreground">{mockInstances.reduce((acc, i) => acc + i.admins, 0)}</div>
                <div className="text-sm text-muted-foreground">Administratorzy</div>
              </div>
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-primary">{mockInstances.reduce((acc, i) => acc + i.reservationsToday, 0)}</div>
                <div className="text-sm text-muted-foreground">Rezerwacji dzisiaj</div>
              </div>
            </div>

            {/* Instances List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Lista instancji</h2>
              <div className="space-y-3">
                {mockInstances.map((instance) => (
                  <div 
                    key={instance.id}
                    className="glass-card p-4 border-purple-500/10 hover:border-purple-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "w-3 h-3 rounded-full shrink-0",
                          instance.active ? "bg-success" : "bg-muted-foreground"
                        )} />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {instance.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{instance.admins} admin(ów)</span>
                            <span>•</span>
                            <span>{instance.reservationsToday} rezerwacji dziś</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="gap-2 hidden sm:flex"
                          onClick={() => handleSeeAsClient(instance.id, instance.name)}
                        >
                          <Eye className="w-4 h-4" />
                          Zobacz jako klient
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSeeAsClient(instance.id, instance.name)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Zobacz jako klient
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Otwórz panel admina
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="w-4 h-4 mr-2" />
                              Ustawienia whitelabel
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleToggleInstance(instance.id, instance.active)}
                              className={instance.active ? "text-destructive" : "text-success"}
                            >
                              <Power className="w-4 h-4 mr-2" />
                              {instance.active ? 'Wyłącz instancję' : 'Włącz instancję'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default SuperAdminDashboard;
