import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Shield, Building2, Users, Settings, LogOut, 
  Menu, Eye, Power, MoreVertical, Plus, ExternalLink, Loader2, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import InstanceSettingsDialog from '@/components/admin/InstanceSettingsDialog';
import { AllInstancesSmsUsage } from '@/components/admin/AllInstancesSmsUsage';
import { InstanceFeaturesSettings } from '@/components/admin/InstanceFeaturesSettings';

interface Instance {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  nip?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  social_facebook?: string;
  social_instagram?: string;
  created_at: string;
}

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Error fetching instances:', error);
      // Use mock data for demo
      setInstances([
        {
          id: 'inst1',
          name: 'ARM CAR AUTO SPA GDAŃSK',
          slug: 'armcar-gdansk',
          active: true,
          phone: '+48 123 456 789',
          address: 'ul. Przykładowa 123, 80-000 Gdańsk',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'inst2',
          name: 'CLEAN CAR Warszawa',
          slug: 'cleancar-warsaw',
          active: true,
          phone: '+48 987 654 321',
          address: 'ul. Testowa 456, 00-001 Warszawa',
          created_at: '2025-02-15T00:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSeeAsClient = (instanceId: string, instanceSlug: string) => {
    toast.info(`Otwieranie widoku klienta dla: ${instanceSlug}`);
    // In production, navigate to /{slug}
  };

  const handleToggleInstance = async (instanceId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('instances')
        .update({ active: !currentState })
        .eq('id', instanceId);

      if (error) throw error;

      setInstances(prev => 
        prev.map(i => i.id === instanceId ? { ...i, active: !currentState } : i)
      );
      toast.success(`Instancja ${currentState ? 'wyłączona' : 'włączona'}`);
    } catch (error) {
      toast.error('Błąd podczas zmiany statusu instancji');
    }
  };

  const handleCreateInstance = () => {
    toast.info('Formularz tworzenia nowej instancji - w przygotowaniu');
  };

  const handleOpenSettings = (instance: Instance) => {
    setSelectedInstance(instance);
    setSettingsOpen(true);
  };

  const handleOpenFeatures = (instance: Instance) => {
    setSelectedInstance(instance);
    setFeaturesOpen(true);
  };

  const handleInstanceUpdate = (updatedInstance: Instance) => {
    setInstances(prev => 
      prev.map(i => i.id === updatedInstance.id ? updatedInstance : i)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

            {/* User Info & Logout */}
            <div className="p-4 border-t border-purple-500/20 space-y-2">
              {user && (
                <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                  {user.email}
                </div>
              )}
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
              <Button 
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white gap-2"
                onClick={handleCreateInstance}
              >
                <Plus className="w-4 h-4" />
                Nowa instancja
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-foreground">{instances.length}</div>
                <div className="text-sm text-muted-foreground">Wszystkie instancje</div>
              </div>
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-success">{instances.filter(i => i.active).length}</div>
                <div className="text-sm text-muted-foreground">Aktywne</div>
              </div>
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-foreground">-</div>
                <div className="text-sm text-muted-foreground">Administratorzy</div>
              </div>
              <div className="glass-card p-4 border-purple-500/20">
                <div className="text-2xl font-bold text-primary">-</div>
                <div className="text-sm text-muted-foreground">Rezerwacji dzisiaj</div>
              </div>
            </div>

            {/* SMS Usage */}
            <AllInstancesSmsUsage />

            {/* Instances List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Lista instancji</h2>
              <div className="space-y-3">
                {instances.map((instance) => (
                  <div 
                    key={instance.id}
                    className="glass-card p-4 border-purple-500/10 hover:border-purple-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Logo or status indicator */}
                        {instance.logo_url ? (
                          <img 
                            src={instance.logo_url} 
                            alt={instance.name} 
                            className="w-10 h-10 rounded-lg object-contain bg-white/10 shrink-0"
                          />
                        ) : (
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                            instance.active ? "bg-success/20" : "bg-muted"
                          )}>
                            <Building2 className={cn(
                              "w-5 h-5",
                              instance.active ? "text-success" : "text-muted-foreground"
                            )} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {instance.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{instance.slug}</span>
                            {instance.phone && (
                              <>
                                <span>•</span>
                                <span>{instance.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="gap-2 hidden sm:flex"
                          onClick={() => handleSeeAsClient(instance.id, instance.slug)}
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
                            <DropdownMenuItem onClick={() => handleSeeAsClient(instance.id, instance.slug)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Zobacz jako klient
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Otwórz panel admina
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenSettings(instance)}>
                              <Settings className="w-4 h-4 mr-2" />
                              Ustawienia whitelabel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenFeatures(instance)}>
                              <FileText className="w-4 h-4 mr-2" />
                              Funkcje płatne
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

      {/* Instance Settings Dialog */}
      <InstanceSettingsDialog 
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        instance={selectedInstance}
        onUpdate={handleInstanceUpdate}
      />

      {/* Instance Features Dialog */}
      {selectedInstance && (
        <Dialog open={featuresOpen} onOpenChange={setFeaturesOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Funkcje płatne - {selectedInstance.name}</DialogTitle>
            </DialogHeader>
            <InstanceFeaturesSettings instanceId={selectedInstance.id} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default SuperAdminDashboard;
