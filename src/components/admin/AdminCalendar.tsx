import { useState, DragEvent, useRef, useCallback, useEffect } from 'react';
import { format, addDays, subDays, isSameDay, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User, Car, Clock, Plus, Eye, EyeOff, Calendar, CalendarDays, Phone, Columns2, GripVertical, Coffee, X, Settings2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type ViewMode = 'day' | 'two-days' | 'week';

interface Station {
  id: string;
  name: string;
  type: string;
}

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone?: string;
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

interface Break {
  id: string;
  station_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

interface AdminCalendarProps {
  stations: Station[];
  reservations: Reservation[];
  breaks?: Break[];
  workingHours?: Record<string, { open: string; close: string } | null> | null;
  onReservationClick?: (reservation: Reservation) => void;
  onAddReservation?: (stationId: string, date: string, time: string) => void;
  onAddBreak?: (stationId: string, date: string, time: string) => void;
  onDeleteBreak?: (breakId: string) => void;
  onReservationMove?: (reservationId: string, newStationId: string, newDate: string, newTime?: string) => void;
}

// Default hours from 9:00 to 19:00
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 19;
const SLOT_MINUTES = 15; // 15-minute slots
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES; // 4 slots per hour
const SLOT_HEIGHT = 20; // pixels per 15 minutes
const HOUR_HEIGHT = SLOT_HEIGHT * SLOTS_PER_HOUR; // 80px per hour

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

const formatTimeSlot = (hour: number, slotIndex: number): string => {
  const minutes = slotIndex * SLOT_MINUTES;
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const AdminCalendar = ({ stations, reservations, breaks = [], workingHours, onReservationClick, onAddReservation, onAddBreak, onDeleteBreak, onReservationMove }: AdminCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [hiddenStationIds, setHiddenStationIds] = useState<Set<string>>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('calendar-hidden-stations');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [draggedReservation, setDraggedReservation] = useState<Reservation | null>(null);
  const [dragOverStation, setDragOverStation] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ hour: number; slotIndex: number } | null>(null);
  const isMobile = useIsMobile();

  // Save hidden stations to localStorage
  useEffect(() => {
    localStorage.setItem('calendar-hidden-stations', JSON.stringify([...hiddenStationIds]));
  }, [hiddenStationIds]);

  const toggleStationVisibility = (stationId: string) => {
    setHiddenStationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stationId)) {
        newSet.delete(stationId);
      } else {
        newSet.add(stationId);
      }
      return newSet;
    });
  };

  const showAllStations = () => {
    setHiddenStationIds(new Set());
  };
  
  // Calculate hours based on working hours for current day
  const getHoursForDate = (date: Date): { hours: number[]; startHour: number; endHour: number; closeTime: string } => {
    if (!workingHours) {
      return {
        hours: Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR }, (_, i) => i + DEFAULT_START_HOUR),
        startHour: DEFAULT_START_HOUR,
        endHour: DEFAULT_END_HOUR,
        closeTime: `${DEFAULT_END_HOUR}:00`
      };
    }
    
    const dayName = format(date, 'EEEE').toLowerCase();
    const dayHours = workingHours[dayName];
    
    // Day is closed or has invalid hours - show default hours
    if (!dayHours || !dayHours.open || !dayHours.close) {
      return {
        hours: Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR }, (_, i) => i + DEFAULT_START_HOUR),
        startHour: DEFAULT_START_HOUR,
        endHour: DEFAULT_END_HOUR,
        closeTime: `${DEFAULT_END_HOUR}:00`
      };
    }
    
    const startHour = parseInt(dayHours.open.split(':')[0]);
    const endHour = parseInt(dayHours.close.split(':')[0]);
    
    // If parsing failed, use defaults
    if (isNaN(startHour) || isNaN(endHour) || endHour <= startHour) {
      return {
        hours: Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR }, (_, i) => i + DEFAULT_START_HOUR),
        startHour: DEFAULT_START_HOUR,
        endHour: DEFAULT_END_HOUR,
        closeTime: `${DEFAULT_END_HOUR}:00`
      };
    }
    
    // Show hours from open to close-1 (the last hour row shows slots up to close time)
    return {
      hours: Array.from({ length: endHour - startHour }, (_, i) => i + startHour),
      startHour,
      endHour,
      closeTime: dayHours.close
    };
  };
  
  const { hours: HOURS, startHour: DAY_START_HOUR, closeTime: DAY_CLOSE_TIME } = getHoursForDate(currentDate);
  
  // Long-press handling for mobile
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const LONG_PRESS_DURATION = 500; // ms

  const handleTouchStart = useCallback((stationId: string, hour: number, slotIndex: number, dateStr?: string) => {
    longPressTriggered.current = false;
    longPressTimeout.current = setTimeout(() => {
      longPressTriggered.current = true;
      const time = formatTimeSlot(hour, slotIndex);
      const targetDate = dateStr || format(currentDate, 'yyyy-MM-dd');
      onAddBreak?.(stationId, targetDate, time);
    }, LONG_PRESS_DURATION);
  }, [currentDate, onAddBreak]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  }, []);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      // Both day and two-days view move by 1 day
      setCurrentDate(subDays(currentDate, 1));
    }
  };
  
  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      // Both day and two-days view move by 1 day
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  // Get two days for two-days view
  const twoDays = [currentDate, addDays(currentDate, 1)];
  
  const handleToday = () => {
    setCurrentDate(new Date());
    setViewMode('day');
  };

  // Get week days for week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const currentDateStr = format(currentDate, 'yyyy-MM-dd');
  const isToday = isSameDay(currentDate, new Date());

  // Filter stations based on hidden station IDs
  const visibleStations = stations.filter(station => !hiddenStationIds.has(station.id));

  const hasHiddenStations = hiddenStationIds.size > 0;

  // Get reservations for a specific date and station
  const getReservationsForStationAndDate = (stationId: string, dateStr: string) => {
    return reservations.filter(
      r => r.reservation_date === dateStr && r.station_id === stationId
    );
  };

  // Get breaks for a specific date and station
  const getBreaksForStationAndDate = (stationId: string, dateStr: string) => {
    return breaks.filter(
      b => b.break_date === dateStr && b.station_id === stationId
    );
  };

  // Get reservations for current day grouped by station (day view)
  const getReservationsForStation = (stationId: string) => {
    return getReservationsForStationAndDate(stationId, currentDateStr);
  };

  // Get breaks for current day grouped by station (day view)
  const getBreaksForStation = (stationId: string) => {
    return getBreaksForStationAndDate(stationId, currentDateStr);
  };

  // Calculate position and height based on time
  const getReservationStyle = (startTime: string, endTime: string) => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const top = (start - DAY_START_HOUR) * HOUR_HEIGHT;
    const height = (end - start) * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${Math.max(height, 30)}px` };
  };

  // Handle click on empty time slot - show context menu or default to reservation
  const handleSlotClick = (stationId: string, hour: number, slotIndex: number, dateStr?: string) => {
    // Prevent click if long-press was triggered
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    const time = formatTimeSlot(hour, slotIndex);
    const targetDate = dateStr || currentDateStr;
    onAddReservation?.(stationId, targetDate, time);
  };

  // Handle right-click to add break
  const handleSlotContextMenu = (e: React.MouseEvent, stationId: string, hour: number, slotIndex: number, dateStr?: string) => {
    e.preventDefault();
    const time = formatTimeSlot(hour, slotIndex);
    const targetDate = dateStr || currentDateStr;
    onAddBreak?.(stationId, targetDate, time);
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, reservation: Reservation) => {
    setDraggedReservation(reservation);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', reservation.id);
  };

  const handleDragEnd = () => {
    setDraggedReservation(null);
    setDragOverStation(null);
    setDragOverDate(null);
    setDragOverSlot(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, stationId: string, dateStr?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStation(stationId);
    if (dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleSlotDragOver = (e: DragEvent<HTMLDivElement>, stationId: string, hour: number, slotIndex: number, dateStr?: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStation(stationId);
    setDragOverSlot({ hour, slotIndex });
    if (dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only clear if we're leaving to an element outside the calendar
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverStation(null);
      setDragOverSlot(null);
    }
  };

  // Get working hours for a specific date
  const getWorkingHoursForDate = (dateStr: string): { closeTime: string; startTime: string } => {
    if (!workingHours) {
      return { startTime: `${DEFAULT_START_HOUR}:00`, closeTime: `${DEFAULT_END_HOUR}:00` };
    }
    const date = new Date(dateStr);
    const dayName = format(date, 'EEEE').toLowerCase();
    const dayHours = workingHours[dayName];
    if (!dayHours) {
      return { startTime: `${DEFAULT_START_HOUR}:00`, closeTime: `${DEFAULT_END_HOUR}:00` };
    }
    return { startTime: dayHours.open, closeTime: dayHours.close };
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, stationId: string, dateStr: string, hour?: number, slotIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStation(null);
    setDragOverDate(null);
    setDragOverSlot(null);
    
    if (draggedReservation) {
      const newTime = hour !== undefined && slotIndex !== undefined 
        ? formatTimeSlot(hour, slotIndex) 
        : undefined;
      
      // Validate that reservation fits within working hours
      if (newTime) {
        const { startTime: dayStartTime, closeTime: dayCloseTime } = getWorkingHoursForDate(dateStr);
        const newStartNum = parseTime(newTime);
        const dayStartNum = parseTime(dayStartTime);
        
        // Check if start time is before opening
        if (newStartNum < dayStartNum) {
          console.warn('Cannot drop reservation before opening time');
          setDraggedReservation(null);
          return;
        }
        
        // Calculate end time of reservation
        const originalStart = parseTime(draggedReservation.start_time);
        const originalEnd = parseTime(draggedReservation.end_time);
        const duration = originalEnd - originalStart;
        const newEndNum = newStartNum + duration;
        const closeNum = parseTime(dayCloseTime);
        
        if (newEndNum > closeNum) {
          console.warn('Reservation would end after closing time');
          setDraggedReservation(null);
          return;
        }
      }
      
      // Allow drop if station changed OR date changed OR time changed
      const stationChanged = draggedReservation.station_id !== stationId;
      const dateChanged = draggedReservation.reservation_date !== dateStr;
      const timeChanged = newTime && newTime !== draggedReservation.start_time;
      
      if (stationChanged || dateChanged || timeChanged) {
        onReservationMove?.(draggedReservation.id, stationId, dateStr, newTime);
      }
    }
    setDraggedReservation(null);
  };

  // Calculate drag preview position
  const getDragPreviewStyle = () => {
    if (!draggedReservation || !dragOverSlot) return null;
    
    const start = parseTime(draggedReservation.start_time);
    const end = parseTime(draggedReservation.end_time);
    const duration = end - start;
    
    const newStartTime = dragOverSlot.hour + (dragOverSlot.slotIndex * SLOT_MINUTES) / 60;
    const top = (newStartTime - DAY_START_HOUR) * HOUR_HEIGHT;
    const height = duration * HOUR_HEIGHT;
    
    return { 
      top: `${top}px`, 
      height: `${Math.max(height, 30)}px`,
      time: formatTimeSlot(dragOverSlot.hour, dragOverSlot.slotIndex)
    };
  };

  const dragPreviewStyle = getDragPreviewStyle();

  // Current time indicator position
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showCurrentTime = isToday && currentHour >= DAY_START_HOUR && currentHour <= parseTime(DAY_CLOSE_TIME);
  const currentTimeTop = (currentHour - DAY_START_HOUR) * HOUR_HEIGHT;

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
          {viewMode === 'week' 
            ? `${format(weekStart, 'd MMM', { locale: pl })} - ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: pl })}`
            : viewMode === 'two-days'
            ? `${format(currentDate, 'd MMM', { locale: pl })} - ${format(addDays(currentDate, 1), 'd MMM yyyy', { locale: pl })}`
            : format(currentDate, 'EEEE, d MMMM yyyy', { locale: pl })
          }
        </h2>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'day' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
              className="rounded-none border-0 px-2 md:px-3"
            >
              <Calendar className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Dzień</span>
            </Button>
            <Button
              variant={viewMode === 'two-days' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('two-days')}
              className="rounded-none border-0 px-2 md:px-3"
            >
              <Columns2 className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">2 dni</span>
            </Button>
            <Button
              variant={viewMode === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="rounded-none border-0 px-2 md:px-3"
            >
              <CalendarDays className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Tydzień</span>
            </Button>
          </div>
          
          {/* Column visibility settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-1", hasHiddenStations && "border-primary text-primary")}
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden md:inline">Kolumny</span>
                {hasHiddenStations && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
                    {hiddenStationIds.size}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Widoczność kolumn</h4>
                  {hasHiddenStations && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={showAllStations}
                      className="h-7 text-xs"
                    >
                      Pokaż wszystkie
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {stations.map((station) => (
                    <div key={station.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`station-${station.id}`}
                        checked={!hiddenStationIds.has(station.id)}
                        onCheckedChange={() => toggleStationVisibility(station.id)}
                      />
                      <Label
                        htmlFor={`station-${station.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {station.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({station.type === 'washing' ? 'mycie' : station.type === 'ppf' ? 'folia' : station.type === 'detailing' ? 'detailing' : 'uniwersalny'})
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Mobile hint for adding breaks */}
      {isMobile && (viewMode === 'day' || viewMode === 'two-days') && (
        <div className="px-4 py-1 bg-muted/30 border-b border-border text-xs text-muted-foreground text-center">
          💡 Przytrzymaj dłużej slot, aby dodać przerwę
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <>
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

          {/* Calendar Grid - Day View */}
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
                    <div className="absolute left-0 right-0 top-0 h-full">
                      {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "border-b",
                            i === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40"
                          )}
                          style={{ height: SLOT_HEIGHT }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Station columns */}
              {visibleStations.map((station, idx) => (
                <div 
                  key={station.id}
                  className={cn(
                    "flex-1 relative min-w-[80px] transition-colors duration-150",
                    idx < visibleStations.length - 1 && "border-r border-border",
                    dragOverStation === station.id && !dragOverSlot && "bg-primary/10"
                  )}
                  onDragOver={(e) => handleDragOver(e, station.id, currentDateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, station.id, currentDateStr)}
                >
                  {/* 5-minute grid slots */}
                  {HOURS.map((hour) => (
                    <div key={hour} style={{ height: HOUR_HEIGHT }}>
                      {Array.from({ length: SLOTS_PER_HOUR }, (_, slotIndex) => {
                        const isDropTarget = dragOverStation === station.id && 
                          dragOverSlot?.hour === hour && 
                          dragOverSlot?.slotIndex === slotIndex;
                        
                        return (
                          <div
                            key={slotIndex}
                            className={cn(
                              "border-b group cursor-pointer transition-colors",
                              slotIndex === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40",
                              isDropTarget && "bg-primary/30 border-primary",
                              !isDropTarget && "hover:bg-primary/10"
                            )}
                            style={{ height: SLOT_HEIGHT }}
                            onClick={() => handleSlotClick(station.id, hour, slotIndex)}
                            onContextMenu={(e) => handleSlotContextMenu(e, station.id, hour, slotIndex, currentDateStr)}
                            onTouchStart={() => handleTouchStart(station.id, hour, slotIndex, currentDateStr)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchMove}
                            onDragOver={(e) => handleSlotDragOver(e, station.id, hour, slotIndex, currentDateStr)}
                            onDrop={(e) => handleDrop(e, station.id, currentDateStr, hour, slotIndex)}
                          >
                            <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-3 h-3 text-primary/50" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Drag preview ghost */}
                  {draggedReservation && dragOverStation === station.id && dragPreviewStyle && (
                    <div
                      className="absolute left-0.5 right-0.5 md:left-1 md:right-1 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none z-10 flex items-center justify-center"
                      style={{ top: dragPreviewStyle.top, height: dragPreviewStyle.height }}
                    >
                      <span className="text-xs font-semibold text-primary bg-background/80 px-2 py-0.5 rounded">
                        {dragPreviewStyle.time}
                      </span>
                    </div>
                  )}

                  {/* Reservations */}
                  {getReservationsForStation(station.id).map((reservation) => {
                    const style = getReservationStyle(reservation.start_time, reservation.end_time);
                    const isDragging = draggedReservation?.id === reservation.id;
                    
                      return (
                      <div
                        key={reservation.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, reservation)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "absolute left-0.5 right-0.5 md:left-1 md:right-1 rounded-lg border-l-4 px-1 md:px-2 py-1 md:py-1.5 cursor-grab active:cursor-grabbing",
                          "transition-all duration-150 hover:shadow-lg hover:scale-[1.02] hover:z-20",
                          "overflow-hidden",
                          getStatusColor(reservation.status),
                          isDragging && "opacity-50 scale-95"
                        )}
                        style={style}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReservationClick?.(reservation);
                        }}
                      >
                        {/* Drag handle - more visible on mobile */}
                        <div className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center opacity-60 hover:opacity-100 touch-none md:w-4 md:opacity-40">
                          <GripVertical className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        </div>
                        <div className="pl-4 md:pl-3">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 text-[10px] md:text-xs font-semibold truncate">
                              <User className="w-3 h-3 shrink-0" />
                              {reservation.customer_name}
                            </div>
                            {reservation.customer_phone && (
                              <a
                                href={`tel:${reservation.customer_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                                title={reservation.customer_phone}
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {reservation.vehicle_plate && (
                            <div className="flex items-center gap-1 text-[10px] md:text-xs truncate opacity-90">
                              <Car className="w-3 h-3 shrink-0" />
                              {reservation.vehicle_plate}
                            </div>
                          )}
                          <div className="text-[10px] md:text-xs truncate opacity-80 mt-0.5">
                            {reservation.start_time.slice(0, 5)} - {reservation.end_time.slice(0, 5)}
                          </div>
                          {reservation.service && (
                            <div className="text-[10px] md:text-xs truncate opacity-70 mt-0.5 hidden lg:block">
                              {reservation.service.name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Breaks */}
                  {getBreaksForStation(station.id).map((breakItem) => {
                    const style = getReservationStyle(breakItem.start_time, breakItem.end_time);
                    
                    return (
                      <div
                        key={breakItem.id}
                        className="absolute left-0.5 right-0.5 md:left-1 md:right-1 rounded-lg border-l-4 px-1 md:px-2 py-1 md:py-1.5 bg-slate-500/80 border-slate-600 text-white overflow-hidden group"
                        style={style}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] md:text-xs font-semibold truncate">
                            <Coffee className="w-3 h-3 shrink-0" />
                            Przerwa
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBreak?.(breakItem.id);
                            }}
                            className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
                            title="Usuń przerwę"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[10px] md:text-xs truncate opacity-80 mt-0.5">
                          {breakItem.start_time.slice(0, 5)} - {breakItem.end_time.slice(0, 5)}
                        </div>
                        {breakItem.note && (
                          <div className="text-[10px] md:text-xs truncate opacity-70 mt-0.5">
                            {breakItem.note}
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
        </>
      )}

      {/* TWO DAYS VIEW */}
      {viewMode === 'two-days' && (
        <>
          {/* Day and Station Headers */}
          <div className="flex border-b border-border bg-muted/20">
            {/* Time column header */}
            <div className="w-14 md:w-16 shrink-0 p-2 text-center text-xs font-medium text-muted-foreground border-r border-border">
              <Clock className="w-4 h-4 mx-auto" />
            </div>
            
            {/* Day + Station headers */}
            {twoDays.map((day, dayIdx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isDayToday = isSameDay(day, new Date());
              
              return (
                <div key={dayStr} className={cn("flex-1 flex flex-col", dayIdx < 1 && "border-r-2 border-border")}>
                  {/* Day header */}
                  <div 
                    className={cn(
                      "p-1 md:p-2 text-center font-medium text-xs border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                      isDayToday && "bg-primary/10"
                    )}
                    onClick={() => {
                      setCurrentDate(day);
                      setViewMode('day');
                    }}
                  >
                    <span className={cn("font-bold", isDayToday && "text-primary")}>
                      {format(day, 'EEEE d MMM', { locale: pl })}
                    </span>
                  </div>
                  {/* Station headers for this day */}
                  <div className="flex">
                    {visibleStations.map((station, stationIdx) => (
                      <div 
                        key={`${dayStr}-${station.id}`}
                        className={cn(
                          "flex-1 p-1 md:p-2 text-center font-medium text-[10px] md:text-xs min-w-[60px]",
                          stationIdx < visibleStations.length - 1 && "border-r border-border"
                        )}
                      >
                        <div className="text-foreground truncate">{station.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendar Grid - Two Days View */}
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
                    <div className="absolute left-0 right-0 top-0 h-full">
                      {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "border-b",
                            i === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40"
                          )}
                          style={{ height: SLOT_HEIGHT }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Day columns with stations */}
              {twoDays.map((day, dayIdx) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const isDayToday = isSameDay(day, new Date());
                
                return (
                  <div key={dayStr} className={cn("flex-1 flex", dayIdx < 1 && "border-r-2 border-border")}>
                    {visibleStations.map((station, stationIdx) => (
                      <div 
                        key={`${dayStr}-${station.id}`}
                        className={cn(
                          "flex-1 relative min-w-[60px] transition-colors duration-150",
                          stationIdx < visibleStations.length - 1 && "border-r border-border",
                          isDayToday && "bg-primary/5",
                          dragOverStation === station.id && dragOverDate === dayStr && !dragOverSlot && "bg-primary/10"
                        )}
                        onDragOver={(e) => handleDragOver(e, station.id, dayStr)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, station.id, dayStr)}
                      >
                        {/* 5-minute grid slots */}
                        {HOURS.map((hour) => (
                          <div key={hour} style={{ height: HOUR_HEIGHT }}>
                            {Array.from({ length: SLOTS_PER_HOUR }, (_, slotIndex) => {
                              const isDropTarget = dragOverStation === station.id && 
                                dragOverDate === dayStr &&
                                dragOverSlot?.hour === hour && 
                                dragOverSlot?.slotIndex === slotIndex;
                              
                              return (
                                <div
                                  key={slotIndex}
                                  className={cn(
                                    "border-b group cursor-pointer transition-colors",
                                    slotIndex % 3 === 0 && "border-border/50",
                                    slotIndex % 3 !== 0 && "border-border/20",
                                    isDropTarget && "bg-primary/30 border-primary",
                                    !isDropTarget && "hover:bg-primary/5"
                                  )}
                                  style={{ height: SLOT_HEIGHT }}
                                  onClick={() => handleSlotClick(station.id, hour, slotIndex, dayStr)}
                                  onContextMenu={(e) => handleSlotContextMenu(e, station.id, hour, slotIndex, dayStr)}
                                  onTouchStart={() => handleTouchStart(station.id, hour, slotIndex, dayStr)}
                                  onTouchEnd={handleTouchEnd}
                                  onTouchMove={handleTouchMove}
                                  onDragOver={(e) => handleSlotDragOver(e, station.id, hour, slotIndex, dayStr)}
                                  onDrop={(e) => handleDrop(e, station.id, dayStr, hour, slotIndex)}
                                >
                                  <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="w-2 h-2 text-primary/50" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}

                        {/* Drag preview ghost */}
                        {draggedReservation && dragOverStation === station.id && dragOverDate === dayStr && dragPreviewStyle && (
                          <div
                            className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none z-10 flex items-center justify-center"
                            style={{ top: dragPreviewStyle.top, height: dragPreviewStyle.height }}
                          >
                            <span className="text-[9px] font-semibold text-primary bg-background/80 px-1 py-0.5 rounded">
                              {dragPreviewStyle.time}
                            </span>
                          </div>
                        )}

                        {/* Reservations */}
                        {getReservationsForStationAndDate(station.id, dayStr).map((reservation) => {
                          const style = getReservationStyle(reservation.start_time, reservation.end_time);
                          const isDragging = draggedReservation?.id === reservation.id;
                          
                          return (
                            <div
                              key={reservation.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, reservation)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "absolute left-0.5 right-0.5 rounded-lg border-l-4 px-1 py-0.5 cursor-grab active:cursor-grabbing",
                                "transition-all duration-150 hover:shadow-lg hover:scale-[1.02] hover:z-20",
                                "overflow-hidden",
                                getStatusColor(reservation.status),
                                isDragging && "opacity-50 scale-95"
                              )}
                              style={style}
                              onClick={(e) => {
                                e.stopPropagation();
                                onReservationClick?.(reservation);
                              }}
                            >
                              {/* Drag handle */}
                              <div className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center opacity-60 hover:opacity-100 touch-none">
                                <GripVertical className="w-2.5 h-2.5" />
                              </div>
                              <div className="pl-3">
                                <div className="flex items-center justify-between gap-0.5">
                                  <div className="flex items-center gap-0.5 text-[9px] md:text-[10px] font-semibold truncate">
                                    <User className="w-2.5 h-2.5 shrink-0" />
                                    {reservation.customer_name}
                                  </div>
                                  {reservation.customer_phone && (
                                    <a
                                      href={`tel:${reservation.customer_phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                                      title={reservation.customer_phone}
                                    >
                                      <Phone className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                                {reservation.vehicle_plate && (
                                  <div className="flex items-center gap-0.5 text-[9px] md:text-[10px] truncate opacity-90">
                                    <Car className="w-2.5 h-2.5 shrink-0" />
                                    {reservation.vehicle_plate}
                                  </div>
                                )}
                                <div className="text-[9px] truncate opacity-80 mt-0.5 hidden md:block">
                                  {reservation.start_time} - {reservation.end_time}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Current time indicator */}
              {twoDays.some(d => isSameDay(d, new Date())) && currentHour >= 8 && currentHour <= 18 && (
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
        </>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <>
          {/* Week Day Headers */}
          <div className="flex border-b border-border bg-muted/20">
            {/* Time column header */}
            <div className="w-14 md:w-16 shrink-0 p-2 text-center text-xs font-medium text-muted-foreground border-r border-border">
              <Clock className="w-4 h-4 mx-auto" />
            </div>
            
            {/* Day headers */}
            {weekDays.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isDayToday = isSameDay(day, new Date());
              const dayReservations = reservations.filter(r => r.reservation_date === dayStr);
              
              return (
                <div 
                  key={dayStr}
                  className={cn(
                    "flex-1 p-2 md:p-3 text-center font-medium text-xs md:text-sm min-w-[100px] cursor-pointer hover:bg-muted/50 transition-colors",
                    idx < 6 && "border-r border-border",
                    isDayToday && "bg-primary/10"
                  )}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode('day');
                  }}
                >
                  <div className={cn(
                    "text-foreground",
                    isDayToday && "text-primary font-bold"
                  )}>
                    {format(day, 'EEEE', { locale: pl })}
                  </div>
                  <div className={cn(
                    "text-lg font-bold",
                    isDayToday && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dayReservations.length} rez.
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendar Grid - Week View (simplified) */}
          <div className="flex-1 overflow-auto">
            <div className="flex relative" style={{ minHeight: HOURS.length * 40 }}>
              {/* Time column */}
              <div className="w-14 md:w-16 shrink-0 border-r border-border bg-muted/10">
                {HOURS.map((hour) => (
                  <div 
                    key={hour}
                    className="relative border-b border-border/50"
                    style={{ height: 40 }}
                  >
                    <span className="absolute -top-2.5 right-1 md:right-2 text-[10px] md:text-xs text-muted-foreground bg-card px-1">
                      {`${hour.toString().padStart(2, '0')}:00`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, idx) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const isDayToday = isSameDay(day, new Date());
                const dayReservations = reservations.filter(r => r.reservation_date === dayStr);
                
                return (
                  <div 
                    key={dayStr}
                    className={cn(
                      "flex-1 relative min-w-[100px]",
                      idx < 6 && "border-r border-border",
                      isDayToday && "bg-primary/5"
                    )}
                  >
                    {/* Hour grid */}
                    {HOURS.map((hour) => (
                      <div 
                        key={hour} 
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                        style={{ height: 40 }}
                        onClick={() => {
                          setCurrentDate(day);
                          setViewMode('day');
                        }}
                      />
                    ))}

                    {/* Reservations for week view */}
                    {dayReservations.map((reservation) => {
                      const start = parseTime(reservation.start_time);
                      const end = parseTime(reservation.end_time);
                      const top = (start - 8) * 40;
                      const height = Math.max((end - start) * 40, 20);
                      
                      return (
                        <div
                          key={reservation.id}
                          className={cn(
                            "absolute left-0.5 right-0.5 rounded px-1 py-0.5 cursor-pointer",
                            "transition-all duration-150 hover:shadow-md hover:z-20",
                            "overflow-hidden text-[9px] md:text-[10px]",
                            getStatusColor(reservation.status)
                          )}
                          style={{ top: `${top}px`, height: `${height}px` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReservationClick?.(reservation);
                          }}
                        >
                          <div className="flex items-center justify-between gap-0.5">
                            <div className="font-semibold truncate">
                              {reservation.customer_name}
                            </div>
                            {reservation.customer_phone && (
                              <a
                                href={`tel:${reservation.customer_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                                title={reservation.customer_phone}
                              >
                                <Phone className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          <div className="truncate opacity-80">
                            {reservation.start_time}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Current time indicator for week view */}
              {weekDays.some(d => isSameDay(d, new Date())) && currentHour >= 8 && currentHour <= 18 && (
                <div 
                  className="absolute left-0 right-0 z-30 pointer-events-none"
                  style={{ top: (currentHour - 8) * 40 }}
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
        </>
      )}

    </div>
  );
};

export default AdminCalendar;
