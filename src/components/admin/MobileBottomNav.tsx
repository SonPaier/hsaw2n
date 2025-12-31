import { useState } from 'react';
import { Calendar, List, Clock, ChevronLeft, ChevronRight, UserCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, isToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

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

type ViewType = 'calendar' | 'reservations' | 'customers' | 'settings';

interface MobileBottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  stations: Station[];
  reservations: Reservation[];
  currentDate: string;
  onAddReservation?: () => void;
  onAddReservationWithSlot?: (stationId: string, date: string, time: string) => void;
}

// Working hours
const START_HOUR = 8;
const END_HOUR = 18;

// Round minutes UP to nearest quarter (0, 15, 30, 45)
const roundUpToQuarter = (minutes: number): number => {
  return Math.ceil(minutes / 15) * 15;
};

// Round minutes DOWN to nearest quarter
const roundDownToQuarter = (minutes: number): number => {
  return Math.floor(minutes / 15) * 15;
};

const MobileBottomNav = ({
  currentView,
  onViewChange,
  stations,
  reservations,
  onAddReservation,
  onAddReservationWithSlot,
}: MobileBottomNavProps) => {
  const [freeSlotsOpen, setFreeSlotsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Calculate free time ranges (gaps) per station for selected date
  const getFreeRangesForDate = (dateStr: string) => {
    const now = new Date();
    const isViewingToday = dateStr === format(now, 'yyyy-MM-dd');
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinutes;
    
    const workStart = START_HOUR * 60;
    const workEnd = END_HOUR * 60;
    
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

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 lg:hidden">
        <div className="flex items-center justify-around py-2 px-4 safe-area-pb">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-3",
              currentView === 'calendar' && "text-primary"
            )}
            onClick={() => onViewChange('calendar')}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">Kalendarz</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-col gap-1 h-auto py-2 px-3"
            onClick={() => setFreeSlotsOpen(true)}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Wolne</span>
          </Button>

          {/* Add Reservation Button */}
          <Button
            size="sm"
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg"
            onClick={onAddReservation}
          >
            <Plus className="w-6 h-6" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-3",
              currentView === 'customers' && "text-primary"
            )}
            onClick={() => onViewChange('customers')}
          >
            <UserCircle className="w-5 h-5" />
            <span className="text-[10px]">Klienci</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-3",
              currentView === 'reservations' && "text-primary"
            )}
            onClick={() => onViewChange('reservations')}
          >
            <List className="w-5 h-5" />
            <span className="text-[10px]">Lista</span>
          </Button>
        </div>
      </nav>

      {/* Free Slots Sheet */}
      <Sheet open={freeSlotsOpen} onOpenChange={setFreeSlotsOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Wolne terminy
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
                  Dziś
                </Button>
              )}
            </div>
            
            <Button variant="ghost" size="icon" onClick={goToNextDay}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="space-y-5 overflow-y-auto pb-8">
            {stationsWithRanges.map(station => (
              <div key={station.id} className="bg-muted/20 rounded-xl p-4 border border-border/50">
                <div className="text-lg font-semibold mb-3">{station.name}</div>
                {station.freeRanges.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {station.freeRanges.map((range, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => handleSlotClick(station.id, range.startTime)}
                        className="flex items-center justify-between bg-success/20 hover:bg-success/30 active:bg-success/40 text-success px-4 py-3 rounded-lg transition-colors text-left"
                      >
                        <span className="text-base font-medium">{range.label}</span>
                        <span className="text-sm opacity-70">({range.duration})</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Brak wolnych terminów</span>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNav;
