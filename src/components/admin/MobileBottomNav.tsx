import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, List, Clock, ChevronLeft, ChevronRight, Plus, MoreHorizontal, Bell, Users, FileText, Package, RefreshCw, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, isToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface Reservation {
  id: string;
  reservation_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  station_id: string | null;
  status: string;
}

type ViewType = 'calendar' | 'reservations' | 'customers' | 'settings' | 'offers' | 'products' | 'followup' | 'notifications';

type WorkingHoursMap = Record<string, { open: string; close: string } | null>;

interface MobileBottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  stations: Station[];
  reservations: Reservation[];
  currentDate: string;
  workingHours?: WorkingHoursMap;
  onAddReservation?: () => void;
  onAddReservationWithSlot?: (stationId: string, date: string, time: string) => void;
  onLogout?: () => void;
  unreadNotificationsCount?: number;
  offersEnabled?: boolean;
  followupEnabled?: boolean;
}

// Default working hours fallback
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 18;

// Round minutes UP to nearest quarter (0, 15, 30, 45)
const roundUpToQuarter = (minutes: number): number => {
  return Math.ceil(minutes / 15) * 15;
};

// Round minutes DOWN to nearest quarter
const roundDownToQuarter = (minutes: number): number => {
  return Math.floor(minutes / 15) * 15;
};

// Parse time string like "09:00" to minutes from midnight
const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const MobileBottomNav = ({
  currentView,
  onViewChange,
  stations,
  reservations,
  workingHours,
  onAddReservation,
  onAddReservationWithSlot,
  onLogout,
  unreadNotificationsCount = 0,
  offersEnabled = true,
  followupEnabled = true,
}: MobileBottomNavProps) => {
  const { t } = useTranslation();
  const [freeSlotsOpen, setFreeSlotsOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Calculate free time ranges (gaps) per station for selected date
  const getFreeRangesForDate = (dateStr: string) => {
    const now = new Date();
    const isViewingToday = dateStr === format(now, 'yyyy-MM-dd');
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinutes;
    
    // Get working hours for this day
    const date = new Date(dateStr);
    const dayName = format(date, 'EEEE').toLowerCase();
    const dayWorkingHours = workingHours?.[dayName];
    
    // If no working hours for this day (closed), return empty
    if (!dayWorkingHours) {
      return stations.map(station => ({
        ...station,
        freeRanges: [],
      }));
    }
    
    const workStart = parseTimeToMinutes(dayWorkingHours.open);
    const workEnd = parseTimeToMinutes(dayWorkingHours.close);
    
    return stations.map(station => {
      const stationReservations = reservations
        .filter(r => {
          if (r.station_id !== station.id || r.status === 'cancelled') return false;
          // Check if date falls within reservation range (for multi-day reservations)
          const startDate = r.reservation_date;
          const endDate = r.end_date || r.reservation_date;
          return dateStr >= startDate && dateStr <= endDate;
        })
        .map(r => ({
          start: parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]),
          end: parseInt(r.end_time.split(':')[0]) * 60 + parseInt(r.end_time.split(':')[1]),
        }))
        .sort((a, b) => a.start - b.start);
      
      // Find gaps
      const gaps: { start: number; end: number; startFormatted: string; endFormatted: string }[] = [];
      let searchStart = isViewingToday ? Math.max(workStart, currentTimeMinutes) : workStart;
      
      // Round searchStart UP to nearest quarter
      searchStart = roundUpToQuarter(searchStart);
      
      for (const res of stationReservations) {
        // Round res.start down to previous quarter for gap calculation
        const resStartRounded = roundDownToQuarter(res.start);
        if (resStartRounded > searchStart) {
          const gapStart = searchStart;
          const gapEnd = resStartRounded;
          const startHour = Math.floor(gapStart / 60);
          const startMin = gapStart % 60;
          const endHour = Math.floor(gapEnd / 60);
          const endMin = gapEnd % 60;
          gaps.push({ 
            start: gapStart, 
            end: gapEnd,
            startFormatted: `${startHour}:${startMin.toString().padStart(2, '0')}`,
            endFormatted: `${endHour}:${endMin.toString().padStart(2, '0')}`,
          });
        }
        searchStart = Math.max(searchStart, roundUpToQuarter(res.end));
      }
      
      if (searchStart < workEnd) {
        const gapStart = searchStart;
        const gapEnd = workEnd;
        const startHour = Math.floor(gapStart / 60);
        const startMin = gapStart % 60;
        const endHour = Math.floor(gapEnd / 60);
        const endMin = gapEnd % 60;
        gaps.push({ 
          start: gapStart, 
          end: gapEnd,
          startFormatted: `${startHour}:${startMin.toString().padStart(2, '0')}`,
          endFormatted: `${endHour}:${endMin.toString().padStart(2, '0')}`,
        });
      }
      
      // Format gaps as clickable slots
      const freeRanges = gaps.map(gap => {
        const durationMinutes = gap.end - gap.start;
        const durationHours = durationMinutes / 60;
        const durationStr = durationHours >= 1 
          ? `${Math.floor(durationHours)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}min` : ''}`
          : `${durationMinutes}min`;
        
        return {
          label: `${gap.startFormatted} - ${gap.endFormatted}`,
          duration: durationStr,
          startTime: gap.startFormatted,
          startMinutes: gap.start,
        };
      });
      
      return {
        ...station,
        freeRanges,
      };
    });
  };

  const stationsWithRanges = getFreeRangesForDate(selectedDateStr);

  const goToPrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  const handleSlotClick = (stationId: string, startTime: string) => {
    if (onAddReservationWithSlot) {
      onAddReservationWithSlot(stationId, selectedDateStr, startTime);
      setFreeSlotsOpen(false);
    }
  };

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
    { id: 'products' as ViewType, icon: Package, label: t('navigation.products') },
    ...(followupEnabled ? [{ id: 'followup' as ViewType, icon: RefreshCw, label: t('navigation.followup') }] : []),
    { id: 'settings' as ViewType, icon: Settings, label: t('navigation.settings') },
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

          {/* Wolne terminy */}
          <button
            className="h-12 w-12 flex items-center justify-center text-muted-foreground"
            onClick={() => setFreeSlotsOpen(true)}
          >
            <Clock className="w-6 h-6" />
          </button>

          {/* Dodaj rezerwację - Central FAB */}
          <Button
            size="sm"
            className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg"
            onClick={onAddReservation}
          >
            <Plus className="w-8 h-8" />
          </Button>

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

          {/* Więcej */}
          <button
            className={cn(
              "h-12 w-12 flex items-center justify-center relative",
              ['customers', 'settings', 'offers', 'products', 'followup', 'notifications'].includes(currentView) ? "text-primary" : "text-muted-foreground"
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
        <SheetContent side="right" className="w-full sm:max-w-full p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <SheetTitle>{t('navigation.more')}</SheetTitle>
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

              <Separator className="my-2" />

              <div className="py-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-muted transition-colors text-destructive"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-base">{t('auth.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Free Slots Sheet */}
      <Sheet open={freeSlotsOpen} onOpenChange={setFreeSlotsOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {t('freeSlots.title')}
            </SheetTitle>
          </SheetHeader>

          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
            <Button variant="ghost" size="icon" onClick={goToPrevDay}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {format(selectedDate, 'd MMMM yyyy', { locale: pl })}
              </span>
              {!isToday(selectedDate) && (
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {t('common.today')}
                </Button>
              )}
            </div>
            
            <Button variant="ghost" size="icon" onClick={goToNextDay}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea className="h-[calc(70vh-140px)]">
            <div className="space-y-5 pb-8 pr-4">
              {stationsWithRanges.map(station => (
                <div key={station.id} className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="text-lg font-semibold mb-3">{station.name}</div>
                  {station.freeRanges.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {station.freeRanges.map((range, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => handleSlotClick(station.id, range.startTime)}
                          className="flex items-center justify-between bg-background hover:bg-muted active:bg-muted/80 border border-border px-4 py-3 rounded-lg transition-colors text-left"
                        >
                          <span className="text-lg font-semibold text-foreground">{range.label}</span>
                          <span className="text-base text-muted-foreground">({range.duration})</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-base text-muted-foreground">{t('freeSlots.noSlots')}</span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNav;
