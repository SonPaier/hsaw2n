import { useState } from 'react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User, Car, Clock, Plus, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface Reservation {
  id: string;
  customer_name: string;
  vehicle_plate: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  station_id: string | null;
  status: string;
  service?: {
    name: string;
  };
}

interface AdminCalendarProps {
  stations: Station[];
  reservations: Reservation[];
  onReservationClick?: (reservation: Reservation) => void;
  onAddReservation?: (stationId: string, date: string, time: string) => void;
}

// Hours from 8:00 to 18:00
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
const QUARTER_HEIGHT = 20; // pixels per 15 minutes
const HOUR_HEIGHT = QUARTER_HEIGHT * 4; // 80px per hour

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-500/90 border-emerald-600 text-white';
    case 'pending':
      return 'bg-amber-500/90 border-amber-600 text-white';
    case 'in_progress':
      return 'bg-blue-500/90 border-blue-600 text-white';
    case 'completed':
      return 'bg-slate-400/80 border-slate-500 text-white';
    case 'cancelled':
      return 'bg-red-400/60 border-red-500 text-white line-through opacity-60';
    default:
      return 'bg-secondary border-border text-foreground';
  }
};

const parseTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
};

const formatTimeSlot = (hour: number, quarter: number): string => {
  const minutes = quarter * 15;
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const AdminCalendar = ({ stations, reservations, onReservationClick, onAddReservation }: AdminCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPpfStations, setShowPpfStations] = useState(false);
  const isMobile = useIsMobile();

  const handlePrev = () => setCurrentDate(subDays(currentDate, 1));
  const handleNext = () => setCurrentDate(addDays(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const currentDateStr = format(currentDate, 'yyyy-MM-dd');
  const isToday = isSameDay(currentDate, new Date());

  // Filter stations - hide PPF on mobile by default
  const visibleStations = stations.filter(station => {
    if (isMobile && !showPpfStations && station.type === 'ppf') {
      return false;
    }
    return true;
  });

  const hasPpfStations = stations.some(s => s.type === 'ppf');

  // Get reservations for current day grouped by station
  const getReservationsForStation = (stationId: string) => {
    return reservations.filter(
      r => r.reservation_date === currentDateStr && r.station_id === stationId
    );
  };

  // Calculate position and height based on time
  const getReservationStyle = (startTime: string, endTime: string) => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const top = (start - 8) * HOUR_HEIGHT;
    const height = (end - start) * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${Math.max(height, 30)}px` };
  };

  // Handle click on empty time slot
  const handleSlotClick = (stationId: string, hour: number, quarter: number) => {
    const time = formatTimeSlot(hour, quarter);
    onAddReservation?.(stationId, currentDateStr, time);
  };

  // Current time indicator position
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showCurrentTime = isToday && currentHour >= 8 && currentHour <= 18;
  const currentTimeTop = (currentHour - 8) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev} className="h-9 w-9">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} className="ml-2">
            Dziś
          </Button>
        </div>
        
        <h2 className={cn(
          "text-lg font-semibold",
          isToday && "text-primary"
        )}>
          {format(currentDate, 'EEEE, d MMMM yyyy', { locale: pl })}
        </h2>

        <div className="flex items-center gap-2">
          {/* Toggle PPF stations on mobile */}
          {isMobile && hasPpfStations && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPpfStations(!showPpfStations)}
              className="text-xs"
            >
              {showPpfStations ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              Folie
            </Button>
          )}
        </div>
      </div>

      {/* Station Headers */}
      <div className="flex border-b border-border bg-muted/20">
        {/* Time column header */}
        <div className="w-14 md:w-16 shrink-0 p-2 text-center text-xs font-medium text-muted-foreground border-r border-border">
          <Clock className="w-4 h-4 mx-auto" />
        </div>
        
        {/* Station headers */}
        {visibleStations.map((station, idx) => (
          <div 
            key={station.id}
            className={cn(
              "flex-1 p-2 md:p-3 text-center font-medium text-xs md:text-sm min-w-[80px]",
              idx < visibleStations.length - 1 && "border-r border-border"
            )}
          >
            <div className="text-foreground truncate">{station.name}</div>
            <div className="text-xs text-muted-foreground capitalize hidden md:block">{station.type}</div>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex relative" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>
          {/* Time column */}
          <div className="w-14 md:w-16 shrink-0 border-r border-border bg-muted/10">
            {HOURS.map((hour) => (
              <div 
                key={hour}
                className="relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 right-1 md:right-2 text-[10px] md:text-xs text-muted-foreground bg-card px-1">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </span>
                {/* 15-minute marks in time column */}
                <div className="absolute left-0 right-0 top-0 h-full">
                  <div className="h-1/4 border-b border-border" />
                  <div className="h-1/4 border-b border-border/60" />
                  <div className="h-1/4 border-b border-border" />
                  <div className="h-1/4 border-b border-border/60" />
                </div>
              </div>
            ))}
          </div>

          {/* Station columns */}
          {visibleStations.map((station, idx) => (
            <div 
              key={station.id}
              className={cn(
                "flex-1 relative min-w-[80px]",
                idx < visibleStations.length - 1 && "border-r border-border"
              )}
            >
              {/* 15-minute grid lines with click handlers */}
              {HOURS.map((hour) => (
                <div key={hour} style={{ height: HOUR_HEIGHT }}>
                  {[0, 1, 2, 3].map((quarter) => (
                    <div
                      key={quarter}
                      className={cn(
                        "h-1/4 border-b group cursor-pointer transition-colors hover:bg-primary/5",
                        quarter === 0 && "border-border",
                        quarter === 2 && "border-border/60",
                        (quarter === 1 || quarter === 3) && "border-border/30"
                      )}
                      onClick={() => handleSlotClick(station.id, hour, quarter)}
                    >
                      <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-4 h-4 text-primary/50" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Reservations */}
              {getReservationsForStation(station.id).map((reservation) => {
                const style = getReservationStyle(reservation.start_time, reservation.end_time);
                
                return (
                  <div
                    key={reservation.id}
                    className={cn(
                      "absolute left-0.5 right-0.5 md:left-1 md:right-1 rounded-lg border-l-4 px-1 md:px-2 py-1 md:py-1.5 cursor-pointer",
                      "transition-all duration-150 hover:shadow-lg hover:scale-[1.02] hover:z-20",
                      "overflow-hidden",
                      getStatusColor(reservation.status)
                    )}
                    style={style}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReservationClick?.(reservation);
                    }}
                  >
                    <div className="flex items-center gap-1 text-[10px] md:text-xs font-semibold truncate">
                      <User className="w-3 h-3 shrink-0" />
                      {reservation.customer_name}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] md:text-xs truncate opacity-90">
                      <Car className="w-3 h-3 shrink-0" />
                      {reservation.vehicle_plate}
                    </div>
                    <div className="text-[10px] md:text-xs truncate opacity-80 mt-0.5 hidden md:block">
                      {reservation.start_time} - {reservation.end_time}
                    </div>
                    {reservation.service && (
                      <div className="text-[10px] md:text-xs truncate opacity-70 mt-0.5 hidden lg:block">
                        {reservation.service.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Current time indicator */}
          {showCurrentTime && (
            <div 
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{ top: currentTimeTop }}
            >
              <div className="flex items-center">
                <div className="w-14 md:w-16 flex justify-end pr-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 md:gap-6 p-2 md:p-3 border-t border-border bg-muted/20 flex-wrap">
        <span className="text-[10px] md:text-xs font-medium text-muted-foreground">Status:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm bg-amber-500" />
          <span className="text-[10px] md:text-xs text-muted-foreground">Oczekujące</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[10px] md:text-xs text-muted-foreground">Potwierdzone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm bg-blue-500" />
          <span className="text-[10px] md:text-xs text-muted-foreground">W trakcie</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm bg-slate-400" />
          <span className="text-[10px] md:text-xs text-muted-foreground">Zakończone</span>
        </div>
      </div>
    </div>
  );
};

export default AdminCalendar;
