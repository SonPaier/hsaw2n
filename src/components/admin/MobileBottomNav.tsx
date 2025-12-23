import { useState } from 'react';
import { Calendar, List, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
  start_time: string;
  end_time: string;
  station_id: string | null;
  status: string;
}

interface MobileBottomNavProps {
  currentView: 'calendar' | 'reservations' | 'settings';
  onViewChange: (view: 'calendar' | 'reservations' | 'settings') => void;
  stations: Station[];
  reservations: Reservation[];
  currentDate: string;
}

// Working hours
const START_HOUR = 8;
const END_HOUR = 18;

const MobileBottomNav = ({
  currentView,
  onViewChange,
  stations,
  reservations,
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
        .filter(r => r.station_id === station.id && r.reservation_date === dateStr && r.status !== 'cancelled')
        .map(r => ({
          start: parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]),
          end: parseInt(r.end_time.split(':')[0]) * 60 + parseInt(r.end_time.split(':')[1]),
        }))
        .sort((a, b) => a.start - b.start);
      
      // Find gaps
      const gaps: { start: number; end: number }[] = [];
      let searchStart = isViewingToday ? Math.max(workStart, currentTimeMinutes) : workStart;
      
      for (const res of stationReservations) {
        if (res.start > searchStart) {
          gaps.push({ start: searchStart, end: res.start });
        }
        searchStart = Math.max(searchStart, res.end);
      }
      
      if (searchStart < workEnd) {
        gaps.push({ start: searchStart, end: workEnd });
      }
      
      // Format gaps as readable strings
      const freeRanges = gaps.map(gap => {
        const startHour = Math.floor(gap.start / 60);
        const startMin = gap.start % 60;
        const endHour = Math.floor(gap.end / 60);
        const endMin = gap.end % 60;
        const durationHours = (gap.end - gap.start) / 60;
        
        const startStr = `${startHour}:${startMin.toString().padStart(2, '0')}`;
        const endStr = `${endHour}:${endMin.toString().padStart(2, '0')}`;
        const durationStr = durationHours >= 1 
          ? `${Math.floor(durationHours)}h${durationHours % 1 > 0 ? ` ${Math.round((durationHours % 1) * 60)}min` : ''}`
          : `${Math.round(durationHours * 60)}min`;
        
        return {
          label: `${startStr} - ${endStr}`,
          duration: durationStr,
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

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 lg:hidden">
        <div className="flex items-center justify-around py-2 px-4 safe-area-pb">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-4",
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
            className="flex-col gap-1 h-auto py-2 px-4"
            onClick={() => setFreeSlotsOpen(true)}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Wolne</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-col gap-1 h-auto py-2 px-4",
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

          <div className="space-y-4 overflow-y-auto pb-8">
            {stationsWithRanges.map(station => (
              <div key={station.id} className="bg-secondary/30 rounded-lg p-3">
                <div className="text-sm font-medium mb-2">{station.name}</div>
                {station.freeRanges.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {station.freeRanges.map((range, idx) => (
                      <span 
                        key={idx} 
                        className="text-xs bg-success/20 text-success px-2 py-1 rounded"
                      >
                        {range.label} <span className="opacity-70">({range.duration})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Brak wolnych terminów</span>
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
