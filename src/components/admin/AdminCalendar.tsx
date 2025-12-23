import { useState, useMemo } from 'react';
import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, User, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 - 18:00

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-success/80 border-success text-success-foreground';
    case 'pending':
      return 'bg-warning/80 border-warning text-warning-foreground';
    case 'in_progress':
      return 'bg-primary/80 border-primary text-primary-foreground';
    case 'completed':
      return 'bg-muted border-muted-foreground/50 text-muted-foreground';
    case 'cancelled':
      return 'bg-destructive/50 border-destructive text-destructive-foreground line-through';
    default:
      return 'bg-secondary border-border';
  }
};

const parseTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
};

const AdminCalendar = ({ stations, reservations, onReservationClick }: AdminCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const displayDays = view === 'day' ? [currentDate] : weekDays;

  const handlePrev = () => {
    if (view === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getReservationsForDayAndStation = (day: Date, stationId: string) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return reservations.filter(
      r => r.reservation_date === dayStr && r.station_id === stationId
    );
  };

  const calculatePosition = (startTime: string, endTime: string) => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const top = ((start - 8) / 10) * 100; // 8:00 is 0%, 18:00 is 100%
    const height = ((end - start) / 10) * 100;
    return { top: `${top}%`, height: `${height}%` };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Dziś
          </Button>
          <h2 className="text-lg font-semibold text-foreground ml-2">
            {view === 'day' 
              ? format(currentDate, 'd MMMM yyyy', { locale: pl })
              : `${format(weekStart, 'd MMM', { locale: pl })} - ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: pl })}`
            }
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'day' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('day')}
          >
            Dzień
          </Button>
          <Button
            variant={view === 'week' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('week')}
          >
            Tydzień
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 glass-card overflow-auto">
        <div className="min-w-[800px]">
          {/* Header with stations */}
          <div className="grid sticky top-0 z-10 bg-card border-b border-border/50" 
               style={{ gridTemplateColumns: `80px repeat(${stations.length * displayDays.length}, 1fr)` }}>
            {/* Time column header */}
            <div className="p-3 border-r border-border/50 font-medium text-muted-foreground text-sm">
              Godzina
            </div>
            
            {/* Day headers */}
            {displayDays.map((day) => (
              <div 
                key={day.toISOString()} 
                className="border-r border-border/50 last:border-r-0"
                style={{ gridColumn: `span ${stations.length}` }}
              >
                <div className={cn(
                  "p-2 text-center border-b border-border/50 font-medium",
                  isSameDay(day, new Date()) && "bg-primary/10 text-primary"
                )}>
                  {format(day, 'EEEE, d MMM', { locale: pl })}
                </div>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${stations.length}, 1fr)` }}>
                  {stations.map((station) => (
                    <div 
                      key={`${day.toISOString()}-${station.id}`}
                      className="p-2 text-center text-sm text-muted-foreground border-r border-border/50 last:border-r-0"
                    >
                      {station.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="relative">
            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div 
                key={hour}
                className="grid border-b border-border/30"
                style={{ 
                  gridTemplateColumns: `80px repeat(${stations.length * displayDays.length}, 1fr)`,
                  height: '60px'
                }}
              >
                {/* Time label */}
                <div className="p-2 text-xs text-muted-foreground border-r border-border/50 flex items-start justify-end pr-3">
                  {`${hour}:00`}
                </div>
                
                {/* Station columns */}
                {displayDays.map((day) => (
                  stations.map((station) => (
                    <div 
                      key={`${day.toISOString()}-${station.id}-${hour}`}
                      className="relative border-r border-border/30 last:border-r-0"
                    />
                  ))
                ))}
              </div>
            ))}

            {/* Reservations overlay */}
            {displayDays.map((day, dayIndex) => (
              stations.map((station, stationIndex) => {
                const dayReservations = getReservationsForDayAndStation(day, station.id);
                const columnIndex = dayIndex * stations.length + stationIndex;
                const columnWidth = `calc((100% - 80px) / ${stations.length * displayDays.length})`;
                const columnLeft = `calc(80px + ${columnIndex} * ${columnWidth})`;

                return dayReservations.map((reservation) => {
                  const { top, height } = calculatePosition(reservation.start_time, reservation.end_time);
                  
                  return (
                    <div
                      key={reservation.id}
                      className={cn(
                        "absolute rounded-md border px-2 py-1 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg overflow-hidden",
                        getStatusColor(reservation.status)
                      )}
                      style={{
                        top,
                        height,
                        left: columnLeft,
                        width: columnWidth,
                        minHeight: '30px',
                      }}
                      onClick={() => onReservationClick?.(reservation)}
                    >
                      <div className="text-xs font-medium truncate flex items-center gap-1">
                        <User className="w-3 h-3 shrink-0" />
                        {reservation.customer_name}
                      </div>
                      <div className="text-xs truncate flex items-center gap-1 opacity-80">
                        <Car className="w-3 h-3 shrink-0" />
                        {reservation.vehicle_plate}
                      </div>
                      {reservation.service && (
                        <div className="text-xs truncate opacity-70">
                          {reservation.service.name}
                        </div>
                      )}
                    </div>
                  );
                });
              })
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <span className="text-sm text-muted-foreground">Status:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-warning" />
          <span className="text-xs text-muted-foreground">Oczekujące</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-success" />
          <span className="text-xs text-muted-foreground">Potwierdzone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-xs text-muted-foreground">W trakcie</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-muted" />
          <span className="text-xs text-muted-foreground">Zakończone</span>
        </div>
      </div>
    </div>
  );
};

export default AdminCalendar;
