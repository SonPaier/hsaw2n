import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Calendar, List, Plus, MoreHorizontal, Bell, Users, FileText, Package, RefreshCw, Settings, LogOut, X, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';


type ViewType = 'calendar' | 'reservations' | 'customers' | 'settings' | 'offers' | 'products' | 'followup' | 'notifications' | 'halls' | 'protocols';

interface MobileBottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onAddReservation?: () => void;
  onLogout?: () => void;
  unreadNotificationsCount?: number;
  offersEnabled?: boolean;
  followupEnabled?: boolean;
  hallViewEnabled?: boolean;
  protocolsEnabled?: boolean;
  userRole?: 'admin' | 'employee' | null;
  currentVersion?: string;
}

const MobileBottomNav = ({
  currentView,
  onViewChange,
  onAddReservation,
  onLogout,
  unreadNotificationsCount = 0,
  offersEnabled = true,
  followupEnabled = true,
  hallViewEnabled = false,
  protocolsEnabled = false,
  userRole = 'admin',
  currentVersion,
}: MobileBottomNavProps) => {
  const { t } = useTranslation();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const handleMoreMenuItemClick = (view: ViewType) => {
    setMoreMenuOpen(false);
    // Delay view change to allow sheet to close first
    setTimeout(() => {
      onViewChange(view);
    }, 100);
  };

  const handleLogout = () => {
    setMoreMenuOpen(false);
    onLogout?.();
  };

  const moreMenuItems = [
    { id: 'notifications' as ViewType, icon: Bell, label: t('navigation.notifications'), badge: unreadNotificationsCount },
    { id: 'customers' as ViewType, icon: Users, label: t('navigation.customers') },
    ...(offersEnabled ? [{ id: 'offers' as ViewType, icon: FileText, label: t('navigation.offers') }] : []),
    // Hidden on mobile: products and followup
    // { id: 'products' as ViewType, icon: Package, label: t('navigation.products') },
    // ...(followupEnabled ? [{ id: 'followup' as ViewType, icon: RefreshCw, label: t('navigation.followup') }] : []),
    // Protocols - visible when feature is enabled and user is admin
    ...(protocolsEnabled && userRole !== 'employee' ? [{ id: 'protocols' as ViewType, icon: ClipboardCheck, label: 'Protokoły' }] : []),
    // Halls - visible when feature is enabled and user is admin
    ...(hallViewEnabled && userRole !== 'employee' ? [{ id: 'halls' as ViewType, icon: Building2, label: t('navigation.halls') }] : []),
    // Hide settings for employees
    ...(userRole !== 'employee' ? [{ id: 'settings' as ViewType, icon: Settings, label: t('navigation.settings') }] : []),
  ];

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 lg:hidden">
        <div className="flex items-center justify-around py-2 px-2 safe-area-pb">
          {/* Kalendarz */}
          <button
            className={cn(
              "h-12 w-12 flex items-center justify-center",
              currentView === 'calendar' ? "text-primary" : "text-muted-foreground"
            )}
            onClick={() => onViewChange('calendar')}
          >
            <Calendar className="w-6 h-6" />
          </button>

          {/* Rezerwacje */}
          <button
            className={cn(
              "h-12 w-12 flex items-center justify-center",
              currentView === 'reservations' ? "text-primary" : "text-muted-foreground"
            )}
            onClick={() => onViewChange('reservations')}
          >
            <List className="w-6 h-6" />
          </button>

          {/* Dodaj rezerwację - Central button */}
          <Button
            size="sm"
            className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg"
            onClick={onAddReservation}
          >
            <Plus className="w-10 h-10" strokeWidth={2.5} />
          </Button>

          {/* Powiadomienia */}
          <button
            className={cn(
              "h-12 w-12 flex items-center justify-center relative",
              currentView === 'notifications' ? "text-primary" : "text-muted-foreground"
            )}
            onClick={() => onViewChange('notifications')}
          >
            <Bell className="w-6 h-6" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full" />
            )}
          </button>

          {/* Więcej */}
          <button
            className={cn(
              "h-12 w-12 flex items-center justify-center relative",
              ['settings', 'offers', 'products', 'followup', 'notifications'].includes(currentView) ? "text-primary" : "text-muted-foreground"
            )}
            onClick={() => setMoreMenuOpen(true)}
          >
            <div className="relative">
              <MoreHorizontal className="w-6 h-6" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full" />
              )}
            </div>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet - Full screen from right */}
      <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <SheetContent side="right" className="w-full sm:max-w-full p-0" hideCloseButton>
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <SheetTitle>{t('navigation.more')}</SheetTitle>
                <button 
                  type="button"
                  onClick={() => setMoreMenuOpen(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-auto">
              <div className="py-2">
                {moreMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleMoreMenuItemClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-muted transition-colors",
                      currentView === item.id && "bg-muted text-primary"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1 text-base">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Version display */}
              <div className="px-6 py-3 text-xs text-muted-foreground">
                Panel Admina {currentVersion && `v${currentVersion}`}
              </div>
            </div>

            {/* Logout button - sticky at bottom */}
            <div className="border-t border-border p-4 safe-area-pb">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors text-destructive"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-base font-medium">{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNav;