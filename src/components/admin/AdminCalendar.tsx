import { useState, DragEvent, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, subDays, isSameDay, startOfWeek, addWeeks, subWeeks, isBefore, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User, Car, Clock, Plus, Eye, EyeOff, Calendar as CalendarIcon, CalendarDays, Phone, Columns2, Coffee, X, Settings2, Check, Ban, CalendarOff, ParkingSquare, MessageSquare, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { YardVehiclesList, YardVehicle } from './YardVehiclesList';
import SendSmsDialog from './SendSmsDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  end_date?: string | null;
  start_time: string;
  end_time: string;
  station_id: string | null;
  status: string;
  customer_notes?: string | null;
  admin_notes?: string | null;
  service?: {
    name: string;
    shortcut?: string | null;
  };
  // Array of all services (if multi-service reservation)
  services_data?: Array<{
    name: string;
    shortcut?: string | null;
  }>;
  station?: {
    type?: string;
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
interface ClosedDay {
  id: string;
  closed_date: string;
  reason: string | null;
}
interface AdminCalendarProps {
  stations: Station[];
  reservations: Reservation[];
  breaks?: Break[];
  closedDays?: ClosedDay[];
  workingHours?: Record<string, {
    open: string;
    close: string;
  } | null> | null;
  onReservationClick?: (reservation: Reservation) => void;
  onAddReservation?: (stationId: string, date: string, time: string) => void;
  onAddBreak?: (stationId: string, date: string, time: string) => void;
  onDeleteBreak?: (breakId: string) => void;
  onToggleClosedDay?: (date: string) => void;
  onReservationMove?: (reservationId: string, newStationId: string, newDate: string, newTime?: string) => void;
  onConfirmReservation?: (reservationId: string) => void;
  onYardVehicleDrop?: (vehicle: YardVehicle, stationId: string, date: string, time: string) => void;
  onDateChange?: (date: Date) => void; // Callback when calendar date changes
  // Hall view props
  allowedViews?: ViewMode[];
  readOnly?: boolean;
  showStationFilter?: boolean;
  showWeekView?: boolean;
  hallMode?: boolean; // Simplified view for hall workers
  instanceId?: string; // Instance ID for yard vehicles
  yardVehicleCount?: number; // Count of vehicles on yard for badge
  selectedReservationId?: string | null; // ID of currently selected reservation (for drawer highlight)
  /** Slot preview for live highlight when creating reservation */
  slotPreview?: {
    date: string;
    startTime: string;
    endTime: string;
    stationId: string;
  } | null;
  /** Whether more reservations are being loaded */
  isLoadingMore?: boolean;
}

// Default hours from 9:00 to 19:00
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 19;
const SLOT_MINUTES = 15; // 15-minute slots
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES; // 4 slots per hour
const SLOT_HEIGHT = 32; // pixels per 15 minutes (increased for 3 lines in 30min + padding)
const HOUR_HEIGHT = SLOT_HEIGHT * SLOTS_PER_HOUR; // 108px per hour

const getStatusColor = (status: string, stationType?: string) => {
  // PPF reservations get special colors
  if (stationType === 'ppf') {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-200 border-emerald-400 text-emerald-900';
      case 'pending':
        return 'bg-amber-100 border-amber-300 text-amber-900';
      case 'in_progress':
        return 'bg-emerald-200 border-emerald-400 text-emerald-900';
      case 'completed':
        return 'bg-sky-200 border-sky-400 text-sky-900';
      case 'released':
        return 'bg-slate-200 border-slate-400 text-slate-700';
      case 'cancelled':
        return 'bg-slate-100/40 border-slate-200 text-slate-500 line-through opacity-60';
      default:
        return 'bg-amber-100 border-amber-300 text-amber-900';
    }
  }

  // Pastel colors for regular stations
  switch (status) {
    case 'pending':
      // Żółty pastelowy - oczekuje na potwierdzenie
      return 'bg-amber-100 border-amber-300 text-amber-900';
    case 'confirmed':
      // Zielony pastelowy - potwierdzona
      return 'bg-emerald-200 border-emerald-400 text-emerald-900';
    case 'in_progress':
      // Taki sam jak confirmed - z pulsującą kropką przy godzinach
      return 'bg-emerald-200 border-emerald-400 text-emerald-900';
    case 'completed':
      // Niebieski pastelowy - gotowy do wydania
      return 'bg-sky-200 border-sky-400 text-sky-900';
    case 'released':
      // Szary - wydane
      return 'bg-slate-200 border-slate-400 text-slate-700';
    case 'cancelled':
      // Czerwony - anulowana
      return 'bg-red-100/60 border-red-300 text-red-700 line-through opacity-60';
    case 'change_requested':
      // Pomarańczowy - prośba o zmianę terminu
      return 'bg-orange-200 border-orange-400 text-orange-900';
    default:
      return 'bg-amber-100 border-amber-300 text-amber-900';
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
const AdminCalendar = ({
  stations,
  reservations,
  breaks = [],
  closedDays = [],
  workingHours,
  onReservationClick,
  onAddReservation,
  onAddBreak,
  onDeleteBreak,
  onToggleClosedDay,
  onReservationMove,
  onConfirmReservation,
  onYardVehicleDrop,
  onDateChange,
  allowedViews = ['day', 'two-days', 'week'],
  readOnly = false,
  showStationFilter = true,
  showWeekView = true,
  hallMode = false,
  instanceId,
  yardVehicleCount = 0,
  selectedReservationId,
  slotPreview,
  isLoadingMore = false
}: AdminCalendarProps) => {
  const {
    t
  } = useTranslation();
  const [currentDate, setCurrentDate] = useState(() => {
    const saved = localStorage.getItem('admin-calendar-date');
    if (saved) {
      try {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) return parsed;
      } catch {}
    }
    return new Date();
  });
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [hiddenStationIds, setHiddenStationIds] = useState<Set<string>>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('calendar-hidden-stations');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [draggedReservation, setDraggedReservation] = useState<Reservation | null>(null);
  const [dragOverStation, setDragOverStation] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{
    hour: number;
    slotIndex: number;
  } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [weekViewStationId, setWeekViewStationId] = useState<string | null>(null);
  const [placDrawerOpen, setPlacDrawerOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsDialogData, setSmsDialogData] = useState<{
    phone: string;
    customerName: string;
  } | null>(null);
  const isMobile = useIsMobile();

  // Notify parent when currentDate changes
  useEffect(() => {
    onDateChange?.(currentDate);
  }, [currentDate, onDateChange]);

  // Refs for synchronized horizontal scroll between headers and grid
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Sync horizontal scroll between headers and grid
  const handleHeaderScroll = useCallback(() => {
    if (headerScrollRef.current && gridScrollRef.current) {
      gridScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
    }
  }, []);
  const handleGridScroll = useCallback(() => {
    if (headerScrollRef.current && gridScrollRef.current) {
      headerScrollRef.current.scrollLeft = gridScrollRef.current.scrollLeft;
    }
  }, []);

  // Mobile column width calculation helpers
  // Column widths are calculated as percentage of available space (screen width minus time column)
  // 1 column: 100%, 2 columns: 50% each, 3+ columns: 40% each (showing 40+40+20% of third)
  const getMobileColumnStyle = (stationCount: number): React.CSSProperties => {
    if (!isMobile) return {};
    if (stationCount === 1) return {
      width: 'calc(100vw - 48px)',
      minWidth: 'calc(100vw - 48px)'
    };
    if (stationCount === 2) return {
      width: 'calc((100vw - 48px) / 2)',
      minWidth: 'calc((100vw - 48px) / 2)'
    };
    // 3+ columns: 40% of available width each
    return {
      width: 'calc((100vw - 48px) * 0.4)',
      minWidth: 'calc((100vw - 48px) * 0.4)'
    };
  };
  const getMobileStationsContainerStyle = (stationCount: number): React.CSSProperties => {
    // Only apply fixed widths on mobile for horizontal scrolling
    if (!isMobile) return {};
    if (stationCount <= 2) return {};
    // For 3+ columns on mobile, set total width to allow horizontal scroll
    return {
      width: `calc((100vw - 48px) * 0.4 * ${stationCount})`
    };
  };

  // Save hidden stations to localStorage
  useEffect(() => {
    localStorage.setItem('calendar-hidden-stations', JSON.stringify([...hiddenStationIds]));
  }, [hiddenStationIds]);

  // Save current date to localStorage
  useEffect(() => {
    localStorage.setItem('admin-calendar-date', format(currentDate, 'yyyy-MM-dd'));
  }, [currentDate]);
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
  // Returns expanded range with 30-min margins before open and after close for hatched areas
  // Supports half-hour working hours like 8:30 or 16:30
  const getHoursForDate = (date: Date): {
    hours: number[];
    startHour: number;
    endHour: number;
    closeTime: string;
    workingStartTime: number; // decimal, e.g., 8.5 for 8:30
    workingEndTime: number; // decimal, e.g., 16.5 for 16:30
    displayStartTime: number; // decimal, start of display (with margin)
    displayEndTime: number; // decimal, end of display (with margin)
    startSlotOffset: number; // slots to skip in first hour (0-3)
    isClosed: boolean; // true if this day has no working hours
  } => {
    const defaultResult = {
      hours: Array.from({
        length: DEFAULT_END_HOUR - DEFAULT_START_HOUR
      }, (_, i) => i + DEFAULT_START_HOUR),
      startHour: DEFAULT_START_HOUR,
      endHour: DEFAULT_END_HOUR,
      closeTime: `${DEFAULT_END_HOUR}:00`,
      workingStartTime: DEFAULT_START_HOUR,
      workingEndTime: DEFAULT_END_HOUR,
      displayStartTime: DEFAULT_START_HOUR,
      displayEndTime: DEFAULT_END_HOUR,
      startSlotOffset: 0,
      isClosed: false
    };
    if (!workingHours) {
      return defaultResult;
    }
    const dayName = format(date, 'EEEE').toLowerCase();
    const dayHours = workingHours[dayName];

    // Day is closed (null in workingHours) - mark as closed
    if (!dayHours || !dayHours.open || !dayHours.close) {
      return {
        ...defaultResult,
        isClosed: true
      };
    }

    // Parse time as decimal to support half-hours (e.g., "8:30" -> 8.5)
    const parseTimeDecimal = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours + (minutes || 0) / 60;
    };
    const workingStartTime = parseTimeDecimal(dayHours.open);
    const workingEndTime = parseTimeDecimal(dayHours.close);

    // If parsing failed, use defaults
    if (isNaN(workingStartTime) || isNaN(workingEndTime) || workingEndTime <= workingStartTime) {
      return defaultResult;
    }

    // Add exactly 30min (0.5 hour) display margin before and after working hours for hatched areas
    // displayStartTime and displayEndTime are in decimal hours (e.g., 8.5 = 8:30)
    const displayStartTime = Math.max(0, workingStartTime - 0.5);
    const displayEndTime = Math.min(24, workingEndTime + 0.5);

    // Calculate the starting full hour for rendering
    // If displayStartTime is e.g. 8.5, we start from hour 8 but will only show slots from :30
    // If displayStartTime is e.g. 9.0, we start from hour 9
    const displayStartHour = Math.floor(displayStartTime);
    const displayEndHour = Math.ceil(displayEndTime);

    // Calculate starting slot offset within the first hour
    // e.g., if displayStartTime = 8.5, startSlotOffset = 2 (skip 8:00 and 8:15 slots)
    const startSlotOffset = Math.round((displayStartTime - displayStartHour) * SLOTS_PER_HOUR);
    return {
      hours: Array.from({
        length: displayEndHour - displayStartHour
      }, (_, i) => i + displayStartHour),
      startHour: displayStartHour,
      endHour: displayEndHour,
      closeTime: dayHours.close,
      workingStartTime,
      workingEndTime,
      displayStartTime,
      // e.g., 8.5 for 8:30 start
      displayEndTime,
      // e.g., 19.5 for 19:30 end
      startSlotOffset,
      // number of slots to skip in first hour (0-3)
      isClosed: false
    };
  };
  const {
    hours: HOURS,
    startHour: DAY_START_HOUR,
    closeTime: DAY_CLOSE_TIME,
    workingStartTime: WORKING_START_TIME,
    workingEndTime: WORKING_END_TIME,
    displayStartTime: DISPLAY_START_TIME,
    displayEndTime: DISPLAY_END_TIME,
    startSlotOffset: START_SLOT_OFFSET
  } = getHoursForDate(currentDate);

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
  const weekStart = startOfWeek(currentDate, {
    weekStartsOn: 1
  }); // Monday
  const weekDays = Array.from({
    length: 7
  }, (_, i) => addDays(weekStart, i));
  const currentDateStr = format(currentDate, 'yyyy-MM-dd');
  const isToday = isSameDay(currentDate, new Date());

  // Check if a date is closed
  const isDateClosed = (dateStr: string) => {
    return closedDays.some(cd => cd.closed_date === dateStr);
  };
  const currentDateClosed = isDateClosed(currentDateStr);

  // Filter stations based on hidden station IDs
  const visibleStations = stations.filter(station => !hiddenStationIds.has(station.id));
  const hasHiddenStations = hiddenStationIds.size > 0;

  // Get reservations for a specific date and station (including multi-day reservations)
  const getReservationsForStationAndDate = (stationId: string, dateStr: string) => {
    return reservations.filter(r => {
      if (r.station_id !== stationId) return false;
      // Exclude cancelled and no_show from calendar view
      if (r.status === 'cancelled' || r.status === 'no_show') return false;

      // Check if date falls within reservation range
      const startDate = r.reservation_date;
      const endDate = r.end_date || r.reservation_date; // Use reservation_date if no end_date

      // dateStr should be >= startDate and <= endDate
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  // Get breaks for a specific date and station
  const getBreaksForStationAndDate = (stationId: string, dateStr: string) => {
    return breaks.filter(b => b.break_date === dateStr && b.station_id === stationId);
  };

  // Get reservations for current day grouped by station (day view)
  const getReservationsForStation = (stationId: string) => {
    return getReservationsForStationAndDate(stationId, currentDateStr);
  };

  // Get breaks for current day grouped by station (day view)
  const getBreaksForStation = (stationId: string) => {
    return getBreaksForStationAndDate(stationId, currentDateStr);
  };

  // Calculate overlap position for reservations that overlap in time
  const getOverlapInfo = (reservation: Reservation, allReservations: Reservation[], dateStr: string) => {
    const {
      displayStart: resStart,
      displayEnd: resEnd
    } = getDisplayTimesForDate(reservation, dateStr);
    const resStartNum = parseTime(resStart);
    const resEndNum = parseTime(resEnd);

    // Find all overlapping reservations (excluding cancelled and no_show)
    const overlapping = allReservations.filter(r => {
      if (r.id === reservation.id || r.status === 'cancelled' || r.status === 'no_show') return false;
      const {
        displayStart: rStart,
        displayEnd: rEnd
      } = getDisplayTimesForDate(r, dateStr);
      const rStartNum = parseTime(rStart);
      const rEndNum = parseTime(rEnd);
      // Check if time ranges overlap
      return resStartNum < rEndNum && resEndNum > rStartNum;
    });
    if (overlapping.length === 0) {
      return {
        hasOverlap: false,
        index: 0,
        total: 1
      };
    }

    // Include current reservation in the group
    const group = [reservation, ...overlapping];
    // Sort by start time, then by id for consistent ordering
    group.sort((a, b) => {
      const {
        displayStart: aStart
      } = getDisplayTimesForDate(a, dateStr);
      const {
        displayStart: bStart
      } = getDisplayTimesForDate(b, dateStr);
      const timeDiff = parseTime(aStart) - parseTime(bStart);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
    const index = group.findIndex(r => r.id === reservation.id);
    return {
      hasOverlap: true,
      index,
      total: group.length
    };
  };

  // Calculate free time for a station on a given date
  const getFreeTimeForStation = (stationId: string, dateStr: string): {
    hours: number;
    minutes: number;
  } | null => {
    const {
      startTime,
      closeTime
    } = getWorkingHoursForDate(dateStr);

    // Check if day is closed or has invalid hours
    if (!startTime || !closeTime) {
      return null;
    }
    const openHour = parseTime(startTime);
    const closeHour = parseTime(closeTime);

    // Handle NaN or invalid values
    if (isNaN(openHour) || isNaN(closeHour) || closeHour <= openHour) {
      return null;
    }
    const totalWorkingMinutes = (closeHour - openHour) * 60;

    // Get all reservations for this station on this date (excluding cancelled and no_show)
    const stationReservations = reservations.filter(r => {
      if (r.station_id !== stationId || r.status === 'cancelled' || r.status === 'no_show') return false;
      const startDate = r.reservation_date;
      const endDate = r.end_date || r.reservation_date;
      return dateStr >= startDate && dateStr <= endDate;
    });

    // Calculate booked minutes
    let bookedMinutes = 0;
    stationReservations.forEach(r => {
      const {
        displayStart,
        displayEnd
      } = getDisplayTimesForDate(r, dateStr);
      const start = parseTime(displayStart);
      const end = parseTime(displayEnd);
      if (!isNaN(start) && !isNaN(end)) {
        bookedMinutes += (end - start) * 60;
      }
    });

    // Get breaks for this station
    const stationBreaks = getBreaksForStationAndDate(stationId, dateStr);
    stationBreaks.forEach(b => {
      const start = parseTime(b.start_time);
      const end = parseTime(b.end_time);
      if (!isNaN(start) && !isNaN(end)) {
        bookedMinutes += (end - start) * 60;
      }
    });
    const freeMinutes = Math.max(0, totalWorkingMinutes - bookedMinutes);
    return {
      hours: Math.floor(freeMinutes / 60),
      minutes: Math.round(freeMinutes % 60)
    };
  };

  // Format free time as string
  const formatFreeTime = (stationId: string, dateStr: string): string | null => {
    // Don't show for closed days or past dates
    if (isDateClosed(dateStr)) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return null;
    const freeTime = getFreeTimeForStation(stationId, dateStr);
    if (!freeTime) return null;
    const {
      hours,
      minutes
    } = freeTime;
    if (hours === 0 && minutes === 0) return t('calendar.noFreeTime');
    if (hours === 0) return t('calendar.freeMinutes', {
      minutes
    });
    if (minutes === 0) return t('calendar.freeHours', {
      hours
    });
    return t('calendar.freeHoursMinutes', {
      hours,
      minutes
    });
  };

  // Calculate position and height based on time
  // Note: position is relative to DISPLAY_START_TIME (the visible start of calendar)
  const getReservationStyle = (startTime: string, endTime: string, displayStartTime?: number) => {
    const referenceStart = displayStartTime ?? DISPLAY_START_TIME;
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const top = (start - referenceStart) * HOUR_HEIGHT + 1; // +1px offset from top
    const height = (end - start) * HOUR_HEIGHT - 2; // -2px to create 1px gap top and bottom
    return {
      top: `${top}px`,
      height: `${Math.max(height, 28)}px`
    };
  };

  // Get display times for a multi-day reservation on a specific date
  const getDisplayTimesForDate = (reservation: Reservation, dateStr: string): {
    displayStart: string;
    displayEnd: string;
  } => {
    const isFirstDay = reservation.reservation_date === dateStr;
    const isLastDay = (reservation.end_date || reservation.reservation_date) === dateStr;
    const {
      startTime: dayOpen,
      closeTime: dayClose
    } = getWorkingHoursForDate(dateStr);
    let displayStart = reservation.start_time;
    let displayEnd = reservation.end_time;

    // If not first day, start from opening time
    if (!isFirstDay) {
      displayStart = dayOpen;
    }

    // If not last day, end at closing time
    if (!isLastDay) {
      displayEnd = dayClose;
    }
    return {
      displayStart,
      displayEnd
    };
  };

  // Handle click on empty time slot - show context menu or default to reservation
  const handleSlotClick = (stationId: string, hour: number, slotIndex: number, dateStr?: string) => {
    // In read-only mode, do nothing
    if (readOnly) return;

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
    // In read-only mode, do nothing
    if (readOnly) return;
    const time = formatTimeSlot(hour, slotIndex);
    const targetDate = dateStr || currentDateStr;
    onAddBreak?.(stationId, targetDate, time);
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, reservation: Reservation) => {
    // In read-only mode, disable drag
    if (readOnly) {
      e.preventDefault();
      return;
    }
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
    setDragOverSlot({
      hour,
      slotIndex
    });
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
  const getWorkingHoursForDate = (dateStr: string): {
    closeTime: string;
    startTime: string;
  } => {
    if (!workingHours) {
      return {
        startTime: `${DEFAULT_START_HOUR}:00`,
        closeTime: `${DEFAULT_END_HOUR}:00`
      };
    }
    const date = new Date(dateStr);
    const dayName = format(date, 'EEEE').toLowerCase();
    const dayHours = workingHours[dayName];
    if (!dayHours) {
      return {
        startTime: `${DEFAULT_START_HOUR}:00`,
        closeTime: `${DEFAULT_END_HOUR}:00`
      };
    }
    return {
      startTime: dayHours.open,
      closeTime: dayHours.close
    };
  };

  // Check if a time slot overlaps with existing reservations (including multi-day)
  const checkOverlap = (stationId: string, dateStr: string, startTime: string, endTime: string, excludeReservationId?: string): boolean => {
    const stationReservations = reservations.filter(r => {
      if (r.station_id !== stationId || r.id === excludeReservationId || r.status === 'cancelled' || r.status === 'no_show') return false;

      // Check if date falls within reservation range
      const startDate = r.reservation_date;
      const endDate = r.end_date || r.reservation_date;
      return dateStr >= startDate && dateStr <= endDate;
    });
    const newStart = parseTime(startTime);
    const newEnd = parseTime(endTime);
    for (const reservation of stationReservations) {
      const resStart = parseTime(reservation.start_time);
      const resEnd = parseTime(reservation.end_time);

      // Check if time ranges overlap
      if (newStart < resEnd && newEnd > resStart) {
        return true; // Overlap detected
      }
    }
    return false; // No overlap
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>, stationId: string, dateStr: string, hour?: number, slotIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStation(null);
    setDragOverDate(null);
    setDragOverSlot(null);

    // Check if this is a yard vehicle drop
    const yardVehicleData = e.dataTransfer.getData('application/yard-vehicle');
    if (yardVehicleData && hour !== undefined && slotIndex !== undefined) {
      try {
        const vehicle = JSON.parse(yardVehicleData) as YardVehicle;
        const dropTime = formatTimeSlot(hour, slotIndex);
        onYardVehicleDrop?.(vehicle, stationId, dateStr, dropTime);
      } catch (err) {
        console.error('Error parsing yard vehicle data:', err);
      }
      return;
    }
    if (draggedReservation) {
      // Check station type compatibility
      const sourceStation = stations.find(s => s.id === draggedReservation.station_id);
      const targetStation = stations.find(s => s.id === stationId);
      if (sourceStation && targetStation) {
        const sourceType = sourceStation.type;
        const targetType = targetStation.type;

        // Prevent moving between incompatible station types
        // PPF can only go to PPF, washing can only go to washing/universal, etc.
        const isCompatible = () => {
          // Same type is always compatible
          if (sourceType === targetType) return true;

          // Universal stations can accept anything
          if (targetType === 'universal') return true;

          // From universal, can go anywhere
          if (sourceType === 'universal') return true;

          // PPF can only go to PPF or universal
          if (sourceType === 'ppf' && targetType !== 'ppf') return false;

          // Washing can only go to washing or universal
          if (sourceType === 'washing' && targetType !== 'washing') return false;

          // Detailing can only go to detailing or universal
          if (sourceType === 'detailing' && targetType !== 'detailing') return false;
          return false;
        };
        if (!isCompatible()) {
          console.warn(`Cannot move reservation from ${sourceType} station to ${targetType} station`);
          setDraggedReservation(null);
          return;
        }
      }
      const newTime = hour !== undefined && slotIndex !== undefined ? formatTimeSlot(hour, slotIndex) : undefined;

      // Validate that reservation fits within working hours
      if (newTime) {
        const {
          startTime: dayStartTime,
          closeTime: dayCloseTime
        } = getWorkingHoursForDate(dateStr);
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

        // Overlap check disabled - admin has full control over calendar
        // const newEndTime = `${Math.floor(newEndNum).toString().padStart(2, '0')}:${Math.round(newEndNum % 1 * 60).toString().padStart(2, '0')}`;
        // if (checkOverlap(stationId, dateStr, newTime, newEndTime, draggedReservation.id)) {
        //   console.warn('Cannot drop reservation - overlaps with existing reservation');
        //   setDraggedReservation(null);
        //   return;
        // }
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

  // Calculate drag preview position (relative to displayStartTime)
  const getDragPreviewStyle = () => {
    if (!draggedReservation || !dragOverSlot) return null;
    const start = parseTime(draggedReservation.start_time);
    const end = parseTime(draggedReservation.end_time);
    const duration = end - start;
    const newStartTime = dragOverSlot.hour + dragOverSlot.slotIndex * SLOT_MINUTES / 60;
    const top = (newStartTime - DISPLAY_START_TIME) * HOUR_HEIGHT;
    const height = duration * HOUR_HEIGHT;
    return {
      top: `${top}px`,
      height: `${Math.max(height, 30)}px`,
      time: formatTimeSlot(dragOverSlot.hour, dragOverSlot.slotIndex)
    };
  };
  const dragPreviewStyle = getDragPreviewStyle();

  // Current time indicator position (relative to displayStartTime)
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showCurrentTime = isToday && currentHour >= DISPLAY_START_TIME && currentHour <= parseTime(DAY_CLOSE_TIME);
  const currentTimeTop = (currentHour - DISPLAY_START_TIME) * HOUR_HEIGHT;
  return <div className="flex flex-col h-full bg-card rounded-xl relative">
      {/* Calendar Header - sticky */}
      <div className="flex flex-col py-2 lg:py-3 bg-background sticky top-0 z-50 gap-2 mx-0 px-[16px]">
        {/* First line on mobile: navigation + actions, on desktop: full layout */}
        <div className="flex items-center justify-between gap-2">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev} className="h-9 w-9">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} className={cn("ml-2", hallMode && "hidden sm:flex")}>
              Dziś
            </Button>
            {isLoadingMore && (
              <div className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Ładowanie...</span>
              </div>
            )}
            {/* Date picker button - hidden on mobile, shown on desktop */}
            {!isMobile && <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-1 gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Data</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={currentDate} onSelect={date => {
                if (date) {
                  setCurrentDate(date);
                  setViewMode('day');
                  setDatePickerOpen(false);
                }
              }} initialFocus className="pointer-events-auto" locale={pl} />
                </PopoverContent>
              </Popover>}
            
            {/* Close/Open day button - only in day view and not read-only */}
            {viewMode === 'day' && !readOnly && onToggleClosedDay && <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant={currentDateClosed ? "destructive" : "ghost"} size="icon" className="h-9 w-9" title={currentDateClosed ? t('calendar.openDay') : t('calendar.closeDay')}>
                    {currentDateClosed ? <CalendarOff className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {currentDateClosed ? t('calendar.openDayTitle') : t('calendar.closeDayTitle')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {currentDateClosed ? t('calendar.openDayDescription', {
                    date: format(currentDate, 'd MMMM yyyy', {
                      locale: pl
                    })
                  }) : t('calendar.closeDayDescription', {
                    date: format(currentDate, 'd MMMM yyyy', {
                      locale: pl
                    })
                  })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onToggleClosedDay(currentDateStr)} className={currentDateClosed ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}>
                      {currentDateClosed ? t('calendar.open') : t('calendar.close')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>}
          </div>
          
          {/* Day name - only visible on desktop in header row */}
          {!isMobile && <h2 className={cn("text-lg font-semibold", isToday && "text-primary", currentDateClosed && viewMode === 'day' && "text-red-500", hallMode && "flex-1 text-center")}>
              {viewMode === 'week' ? `${format(weekStart, 'd MMM', {
            locale: pl
          })} - ${format(addDays(weekStart, 6), 'd MMM', {
            locale: pl
          })}` : viewMode === 'two-days' ? `${format(currentDate, 'd MMM', {
            locale: pl
          })} - ${format(addDays(currentDate, 1), 'd MMM', {
            locale: pl
          })}` : format(currentDate, 'EEEE, d MMMM', {
            locale: pl
          })}
            </h2>}
          
          <div className="flex items-center gap-2">
            {/* Station selector for week view */}
            {!isMobile && viewMode === 'week' && stations.length > 0 && <Select value={weekViewStationId || stations[0]?.id || ''} onValueChange={value => setWeekViewStationId(value)}>
                <SelectTrigger className="h-9 w-[140px] text-sm">
                  <SelectValue placeholder={t('stations.title')} />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(station => <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>}
            
            {/* View mode toggle - icons only */}
            {!isMobile && <div className="flex border border-border rounded-lg overflow-hidden">
                {allowedViews.includes('day') && <Button variant={viewMode === 'day' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('day')} className="rounded-none border-0 px-2.5" title="Dzień">
                    <CalendarIcon className="w-4 h-4" />
                  </Button>}
                {allowedViews.includes('two-days') && <Button variant={viewMode === 'two-days' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('two-days')} className="rounded-none border-0 px-2.5" title="2 dni">
                    <Columns2 className="w-4 h-4" />
                  </Button>}
                {allowedViews.includes('week') && showWeekView && <Button variant={viewMode === 'week' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="rounded-none border-0 px-2.5" title="Tydzień">
                    <CalendarDays className="w-4 h-4" />
                  </Button>}
              </div>}
            
            {/* Column visibility settings - only show if not read only */}
            {showStationFilter && <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" title="Kolumny">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Widoczność kolumn</h4>
                      {hasHiddenStations && <Button variant="ghost" size="sm" onClick={showAllStations} className="h-7 text-xs">
                          Pokaż wszystkie
                        </Button>}
                    </div>
                    <div className="space-y-2">
                      {stations.map(station => <div key={station.id} className="flex items-center gap-2">
                          <Checkbox id={`station-${station.id}`} checked={!hiddenStationIds.has(station.id)} onCheckedChange={() => toggleStationVisibility(station.id)} />
                          <Label htmlFor={`station-${station.id}`} className="text-sm cursor-pointer flex-1">
                            {station.name}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({station.type === 'washing' ? 'mycie' : station.type === 'ppf' ? 'folia' : station.type === 'detailing' ? 'detailing' : 'uniwersalny'})
                            </span>
                          </Label>
                        </div>)}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>}
            
            {/* Plac button */}
            <Button variant="outline" size="sm" onClick={() => setPlacDrawerOpen(true)} className="gap-1 relative">
              <ParkingSquare className="w-4 h-4" />
              <span className="hidden md:inline">Plac</span>
              {yardVehicleCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {yardVehicleCount > 99 ? '99+' : yardVehicleCount}
                </span>}
            </Button>
          </div>
        </div>
        
        {/* Second line on mobile: day name centered */}
        {isMobile && <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className={cn("text-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity text-center w-full", isToday && "text-primary", currentDateClosed && viewMode === 'day' && "text-red-500")}>
                {viewMode === 'week' ? `${format(weekStart, 'd MMM', {
              locale: pl
            })} - ${format(addDays(weekStart, 6), 'd MMM', {
              locale: pl
            })}` : viewMode === 'two-days' ? `${format(currentDate, 'd MMM', {
              locale: pl
            })} - ${format(addDays(currentDate, 1), 'd MMM', {
              locale: pl
            })}` : format(currentDate, 'EEEE, d MMMM', {
              locale: pl
            })}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar mode="single" selected={currentDate} onSelect={date => {
            if (date) {
              setCurrentDate(date);
              setViewMode('day');
              setDatePickerOpen(false);
            }
          }} initialFocus className="pointer-events-auto" locale={pl} />
            </PopoverContent>
          </Popover>}
      </div>
      

      {/* DAY VIEW */}
      {viewMode === 'day' && <>
          {/* Station Headers - fixed below toolbar */}
          <div ref={headerScrollRef} onScroll={handleHeaderScroll} className="flex border-b border-border/50 bg-card sticky top-0 z-40 overflow-x-auto" style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
            {/* Time column header - sticky left */}
            <div className={cn("w-12 md:w-16 shrink-0 p-1 md:p-2 flex items-center justify-center text-muted-foreground border-r border-border/50 bg-card", "sticky left-0 z-50")}>
              <Clock className="w-5 h-5" />
            </div>
            
            {/* Station headers container */}
            <div className={cn("flex", !isMobile && "flex-1")} style={getMobileStationsContainerStyle(visibleStations.length)}>
              {visibleStations.map((station, idx) => {
            const freeTimeText = formatFreeTime(station.id, currentDateStr);
            return <div key={station.id} className={cn("p-1 md:p-2 text-center font-semibold text-sm md:text-base shrink-0", !isMobile && "flex-1 min-w-[80px]", idx < visibleStations.length - 1 && "border-r border-border/50")} style={isMobile ? getMobileColumnStyle(visibleStations.length) : undefined}>
                    <div className="text-foreground truncate">{station.name}</div>
                    {/* Always reserve height for free time text */}
                    <div className="text-xs text-primary hidden md:block h-4">
                      {freeTimeText || '\u00A0'}
                    </div>
                  </div>;
          })}
            </div>
          </div>
          
          {/* Main scrollable container - synced horizontal scroll with headers */}
          <div ref={gridScrollRef} onScroll={handleGridScroll} className="flex-1 overflow-auto" style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>

            {/* Calendar Grid - Day View */}
            <div className={cn("flex relative", currentDateClosed && "opacity-50")} style={{
          minHeight: (DISPLAY_END_TIME - DISPLAY_START_TIME) * HOUR_HEIGHT
        }}>
              {/* Closed day overlay */}
              {currentDateClosed && <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                  <div className="bg-red-500/20 backdrop-blur-[1px] absolute inset-0" />
                  <div className="relative bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
                    <CalendarOff className="w-5 h-5" />
                    <span className="font-semibold">Dzień zamknięty</span>
                  </div>
                </div>}
              {/* Time column with quarter-hour marks - sticky left on all devices */}
              <div className="w-12 md:w-16 shrink-0 border-r border-border/50 bg-muted/10 sticky left-0 z-30 bg-background">
                {HOURS.map((hour, hourIndex) => {
              // Calculate which slots to show for this hour
              const isFirstHour = hourIndex === 0;
              const isLastHour = hourIndex === HOURS.length - 1;
              const slotsToSkip = isFirstHour ? START_SLOT_OFFSET : 0;

              // For the last hour, we may need to cut off early based on DISPLAY_END_TIME
              const endSlotOffset = isLastHour ? Math.round((DISPLAY_END_TIME - hour) * SLOTS_PER_HOUR) : SLOTS_PER_HOUR;
              const slotsToRender = Math.max(0, endSlotOffset - slotsToSkip);

              // Don't render anything for this hour if all slots are skipped
              if (slotsToRender <= 0) return null;
              const hourBlockHeight = slotsToRender * SLOT_HEIGHT;
              return <div key={hour} className="relative" style={{
                height: hourBlockHeight
              }}>
                      {/* Hour label - show at top of first visible slot */}
                      {slotsToSkip === 0 ? <span className="absolute -top-2.5 right-1 md:right-2 text-xs md:text-sm font-medium text-foreground bg-background px-1 z-10">
                          {`${hour.toString().padStart(2, '0')}:00`}
                        </span> :
                // For partial first hour, show the starting time label (e.g., 8:30)
                <span className="absolute -top-2.5 right-1 md:right-2 text-xs md:text-sm font-medium text-foreground bg-background px-1 z-10">
                          {`${hour.toString().padStart(2, '0')}:${(slotsToSkip * SLOT_MINUTES).toString().padStart(2, '0')}`}
                        </span>}
                      <div className="absolute left-0 right-0 top-0 h-full">
                        {Array.from({
                    length: slotsToRender
                  }, (_, i) => {
                    const actualSlotIndex = i + slotsToSkip;
                    return <div key={actualSlotIndex} className={cn("border-b relative", actualSlotIndex === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/30")} style={{
                      height: SLOT_HEIGHT
                    }}>
                              {/* Quarter-hour labels: show for slots after first in this render */}
                              {i > 0 && <span className="absolute -top-1.5 right-1 md:right-2 text-[9px] md:text-[10px] text-muted-foreground/70 bg-background px-0.5">
                                  {(actualSlotIndex * SLOT_MINUTES).toString()}
                                </span>}
                            </div>;
                  })}
                      </div>
                    </div>;
            })}
              </div>

              {/* Station columns container */}
              <div className={cn("flex", !isMobile && "flex-1")} style={getMobileStationsContainerStyle(visibleStations.length)}>
                {visibleStations.map((station, idx) => {
              // Calculate total visible height based on display time range
              const totalVisibleHeight = (DISPLAY_END_TIME - DISPLAY_START_TIME) * HOUR_HEIGHT;

              // Calculate past time overlay - everything before current time should be hatched
              const now = new Date();
              const currentDateObj = new Date(currentDateStr);
              const isToday = format(now, 'yyyy-MM-dd') === currentDateStr;
              const isPastDay = currentDateObj < new Date(format(now, 'yyyy-MM-dd'));

              // For past days, hatch the entire column
              // For today, do NOT hatch elapsed time - only hatch previous days
              let pastHatchHeight = 0;
              if (isPastDay) {
                pastHatchHeight = totalVisibleHeight;
              }
              return <div key={station.id} className={cn("relative transition-colors duration-150 shrink-0", !isMobile && "flex-1 min-w-[80px]", idx < visibleStations.length - 1 && "border-r border-border", dragOverStation === station.id && !dragOverSlot && "bg-primary/10")} style={isMobile ? getMobileColumnStyle(visibleStations.length) : undefined} onDragOver={e => handleDragOver(e, station.id, currentDateStr)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, station.id, currentDateStr)}>
                    {/* Hatched area for PAST time slots */}
                    {pastHatchHeight > 0 && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-10" style={{
                  height: pastHatchHeight
                }} />}
                  
                  {/* Hatched area BEFORE working hours (exactly 30 min margin) - now at top since we start from displayStartTime */}
                  {DISPLAY_START_TIME < WORKING_START_TIME && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-5" style={{
                  height: (WORKING_START_TIME - DISPLAY_START_TIME) * HOUR_HEIGHT
                }} />}
                  
                  {/* Hatched area AFTER working hours (exactly 30 min margin) */}
                  {DISPLAY_END_TIME > WORKING_END_TIME && <div className="absolute left-0 right-0 hatched-pattern pointer-events-none z-5" style={{
                  top: (WORKING_END_TIME - DISPLAY_START_TIME) * HOUR_HEIGHT,
                  height: (DISPLAY_END_TIME - WORKING_END_TIME) * HOUR_HEIGHT
                }} />}
                  
                  {/* 15-minute grid slots */}
                  {HOURS.map((hour, hourIndex) => {
                  const isFirstHour = hourIndex === 0;
                  const isLastHour = hourIndex === HOURS.length - 1;
                  const slotsToSkip = isFirstHour ? START_SLOT_OFFSET : 0;

                  // Calculate how many slots to render in this hour
                  // For the last hour, we may need to cut off early based on DISPLAY_END_TIME
                  const endSlotOffset = isLastHour ? Math.round((DISPLAY_END_TIME - hour) * SLOTS_PER_HOUR) : SLOTS_PER_HOUR;
                  const slotsToRender = Math.max(0, endSlotOffset - slotsToSkip);
                  if (slotsToRender <= 0) return null;
                  const hourBlockHeight = slotsToRender * SLOT_HEIGHT;
                  return <div key={hour} style={{
                    height: hourBlockHeight
                  }}>
                        {Array.from({
                      length: slotsToRender
                    }, (_, i) => {
                      const slotIndex = i + slotsToSkip;
                      const slotMinutes = slotIndex * SLOT_MINUTES;
                      const slotTimeDecimal = hour + slotMinutes / 60;
                      const isDropTarget = dragOverStation === station.id && dragOverSlot?.hour === hour && dragOverSlot?.slotIndex === slotIndex;

                      // Check if this slot is outside working hours (in hatched area)
                      const isOutsideWorkingHours = slotTimeDecimal < WORKING_START_TIME || slotTimeDecimal >= WORKING_END_TIME;

                      // Disable only for past days (not today's past hours) OR outside working hours OR day is closed
                      // Today's earlier hours remain clickable for admin flexibility
                      const isDisabled = isPastDay || isOutsideWorkingHours || currentDateClosed;
                      return <div key={slotIndex} className={cn("border-b group transition-colors", slotIndex === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40", isDropTarget && !isDisabled && "bg-primary/30 border-primary", !isDropTarget && !isDisabled && "hover:bg-primary/10 cursor-pointer", isDisabled && "cursor-not-allowed")} style={{
                        height: SLOT_HEIGHT
                      }} onClick={() => !isDisabled && handleSlotClick(station.id, hour, slotIndex)} onContextMenu={e => !isDisabled && handleSlotContextMenu(e, station.id, hour, slotIndex, currentDateStr)} onTouchStart={() => !isDisabled && handleTouchStart(station.id, hour, slotIndex, currentDateStr)} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} onDragOver={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isDisabled) handleSlotDragOver(e, station.id, hour, slotIndex, currentDateStr);
                      }} onDrop={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isDisabled) handleDrop(e, station.id, currentDateStr, hour, slotIndex);
                      }}>
                              {/* Hide + on hover in hallMode or disabled slots */}
                              {!hallMode && !isDisabled && <div className="h-full w-full flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Plus className="w-3 h-3 text-primary/50" />
                                  <span className="text-[10px] text-primary/70">{`${hour.toString().padStart(2, '0')}:${(slotIndex * SLOT_MINUTES).toString().padStart(2, '0')}`}</span>
                                </div>}
                            </div>;
                    })}
                      </div>;
                })}

                  {/* Drag preview ghost - enhanced visibility */}
                  {draggedReservation && dragOverStation === station.id && dragPreviewStyle && <div className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none flex items-center justify-center" style={{
                  top: dragPreviewStyle.top,
                  height: dragPreviewStyle.height,
                  zIndex: 10000
                }}>
                      <span className="text-sm font-bold text-foreground bg-background px-3 py-1.5 rounded-md shadow-lg border border-border">
                        Przenieś na {dragPreviewStyle.time}
                      </span>
                    </div>}

                  {/* Slot Preview Highlight */}
                  {slotPreview && 
                   slotPreview.date === currentDateStr && 
                   slotPreview.stationId === station.id && (
                    <div 
                      className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-fuchsia-400 pointer-events-none z-40 animate-pulse"
                      style={{
                        ...getReservationStyle(slotPreview.startTime, slotPreview.endTime),
                        background: 'repeating-linear-gradient(45deg, rgba(236,72,153,0.15), rgba(236,72,153,0.15) 4px, transparent 4px, transparent 8px)'
                      }}
                    >
                      <div className="px-2 py-1 text-xs font-medium text-fuchsia-600">
                        {slotPreview.startTime.slice(0,5)} - {slotPreview.endTime.slice(0,5)}
                      </div>
                    </div>
                  )}

                  {/* Reservations */}
                  {(() => {
                  const stationReservations = getReservationsForStation(station.id);
                  return stationReservations.map(reservation => {
                    const {
                      displayStart,
                      displayEnd
                    } = getDisplayTimesForDate(reservation, currentDateStr);
                    const style = getReservationStyle(displayStart, displayEnd);
                    const isDragging = draggedReservation?.id === reservation.id;
                    const isMultiDay = reservation.end_date && reservation.end_date !== reservation.reservation_date;
                    const isPending = reservation.status === 'pending';
                    const isSelected = selectedReservationId === reservation.id;

                    // Calculate overlap positioning
                    const overlapInfo = getOverlapInfo(reservation, stationReservations, currentDateStr);
                    const widthPercent = overlapInfo.hasOverlap ? 100 / overlapInfo.total : 100;
                    const leftPercent = overlapInfo.hasOverlap ? overlapInfo.index * widthPercent : 0;
                    return <div key={reservation.id} draggable={!hallMode} onDragStart={e => handleDragStart(e, reservation)} onDragEnd={handleDragEnd} className={cn("absolute rounded-lg border px-1 md:px-2 py-0 md:py-1 md:pb-1.5", !hallMode && "cursor-grab active:cursor-grabbing", hallMode && "cursor-pointer", "transition-all duration-150 hover:shadow-lg hover:z-20", "overflow-hidden select-none", getStatusColor(reservation.status, reservation.station?.type || station.type), isDragging && "opacity-30 scale-95", overlapInfo.hasOverlap && !isSelected && "border-2 border-dashed", isSelected && "border-4 shadow-lg z-30")} style={{
                      ...style,
                      left: overlapInfo.hasOverlap ? `calc(${leftPercent}% + 2px)` : '2px',
                      right: overlapInfo.hasOverlap ? `calc(${100 - leftPercent - widthPercent}% + 2px)` : '2px',
                      width: overlapInfo.hasOverlap ? `calc(${widthPercent}% - 4px)` : undefined,
                      zIndex: isSelected ? 30 : (overlapInfo.hasOverlap ? 10 + overlapInfo.index : undefined)
                    }} onClick={e => {
                      e.stopPropagation();
                      onReservationClick?.(reservation);
                    }}>
                        <div className="px-0.5">
                          {/* Line 1: Time range + action buttons */}
                          <div className="flex items-center justify-between gap-0.5">
                            {hallMode ? <div className="text-[11px] md:text-sm font-bold truncate">
                                {isMultiDay ? `${displayStart.slice(0, 5)} - ${displayEnd.slice(0, 5)}` : `${reservation.start_time.slice(0, 5)} - ${reservation.end_time.slice(0, 5)}`}
                              </div> : <span className="text-xs md:text-sm font-bold tabular-nums shrink-0 flex items-center gap-1">
                                {isMultiDay ? `${displayStart.slice(0, 5)}-${displayEnd.slice(0, 5)}` : `${reservation.start_time.slice(0, 5)}-${reservation.end_time.slice(0, 5)}`}
                                {reservation.status === 'in_progress' && <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse-dot" />}
                                {reservation.status === 'change_requested' && <RefreshCw className="w-3 h-3 text-orange-600" />}
                              </span>}
                            {/* Action buttons: Phone, SMS, Notes indicator */}
                            {!hallMode && <div className="flex items-center gap-0.5 shrink-0">
                                {(reservation.admin_notes || reservation.customer_notes) && <div className="p-0.5 rounded" title={reservation.admin_notes || reservation.customer_notes || ''}>
                                    <FileText className="w-3 h-3 opacity-70" />
                                  </div>}
                                {reservation.customer_phone && <>
                                    <button onClick={e => {
                                e.stopPropagation();
                                setSmsDialogData({
                                  phone: reservation.customer_phone!,
                                  customerName: reservation.customer_name
                                });
                                setSmsDialogOpen(true);
                              }} className="p-0.5 rounded hover:bg-white/20 transition-colors" title="Wyślij SMS">
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                    {isMobile && (
                                      <a href={`tel:${reservation.customer_phone}`} onClick={e => e.stopPropagation()} className="p-0.5 rounded hover:bg-white/20 transition-colors" title={reservation.customer_phone}>
                                        <Phone className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </>}
                              </div>}
                          </div>
                          {/* Line 2: Vehicle plate + customer name with ellipsis */}
                          {!hallMode && <div className="flex items-center gap-1 text-xs md:text-sm opacity-90 min-w-0">
                              <span className="font-semibold truncate max-w-[50%]">
                                {reservation.vehicle_plate}
                              </span>
                              <span className="truncate min-w-0 opacity-80">
                                {reservation.customer_name}
                              </span>
                            </div>}
                          {/* Line 3: Service chips */}
                          {reservation.services_data && reservation.services_data.length > 0 ? <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {reservation.services_data.map((svc, idx) => <span key={idx} className="inline-block px-1 py-0.5 text-[9px] md:text-[10px] font-medium bg-slate-700/90 text-white rounded leading-none">
                                  {svc.shortcut || svc.name}
                                </span>)}
                            </div> : reservation.service && <div className="flex flex-wrap gap-0.5 mt-0.5">
                              <span className="inline-block px-1 py-0.5 text-[9px] md:text-[10px] font-medium bg-slate-700/90 text-white rounded leading-none">
                                {reservation.service.shortcut || reservation.service.name}
                              </span>
                            </div>}
                          {/* Line 4: Notes (only if duration > 30 minutes) */}
                          {(() => {
                            const durationMinutes = (parseTime(displayEnd) - parseTime(displayStart)) * 60;
                            const notesToShow = reservation.admin_notes || reservation.customer_notes;
                            if (durationMinutes > 30 && notesToShow) {
                              return <div 
                                className="text-[13px] opacity-70 mt-0.5 break-words overflow-hidden"
                                style={{ 
                                  display: '-webkit-box',
                                  WebkitBoxOrient: 'vertical',
                                  WebkitLineClamp: 'unset'
                                }}
                              >
                                {notesToShow}
                              </div>;
                            }
                            return null;
                          })()}
                        </div>
                      </div>;
                  });
                })()}

                  {/* Breaks */}
                  {getBreaksForStation(station.id).map(breakItem => {
                  const style = getReservationStyle(breakItem.start_time, breakItem.end_time, DISPLAY_START_TIME);
                  return <div key={breakItem.id} className="absolute left-0.5 right-0.5 md:left-1 md:right-1 rounded-lg border-l-4 px-1 md:px-2 py-1 md:py-1.5 bg-slate-500/80 border-slate-600 text-white overflow-hidden group" style={style}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] md:text-xs font-semibold truncate">
                            <Coffee className="w-3 h-3 shrink-0" />
                            {t('calendar.break')}
                          </div>
                          <button onClick={e => {
                        e.stopPropagation();
                        onDeleteBreak?.(breakItem.id);
                      }} className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100" title={t('calendar.deleteBreak')}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[10px] md:text-xs truncate opacity-80 mt-0.5">
                          {breakItem.start_time.slice(0, 5)} - {breakItem.end_time.slice(0, 5)}
                        </div>
                        {breakItem.note && <div className="text-[10px] md:text-xs truncate opacity-70 mt-0.5">
                            {breakItem.note}
                          </div>}
                      </div>;
                })}
                </div>;
            })}
              </div>

              {/* Current time indicator with time label */}
              {showCurrentTime && <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{
            top: currentTimeTop
          }}>
                  <div className="flex items-center">
                    <div className="w-12 md:w-16 flex items-center justify-end pr-1 gap-0.5">
                      <span className="text-[10px] md:text-xs font-semibold text-red-500 bg-background/90 px-1 rounded">
                        {`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`}
                      </span>
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    </div>
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                </div>}
            </div>
          </div>
        </>}

      {/* TWO DAYS VIEW */}
      {viewMode === 'two-days' && <>
          {/* Day and Station Headers */}
          <div className="flex border-b border-border bg-muted/20 sticky top-12 z-40">
            {/* Time column header */}
            <div className="w-10 md:w-16 shrink-0 p-1 md:p-2 text-center text-xs font-medium text-muted-foreground border-r border-border">
              <Clock className="w-4 h-4 mx-auto" />
            </div>
            
            {/* Day + Station headers */}
            {twoDays.map((day, dayIdx) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isDayToday = isSameDay(day, new Date());
          const dayHoursInfo = getHoursForDate(day);
          const isDayClosed = dayHoursInfo.isClosed || isDateClosed(dayStr);
          return <div key={dayStr} className={cn("flex-1 flex flex-col", dayIdx < 1 && "border-r-2 border-border")}>
                  {/* Day header */}
                  <div className={cn("p-1 md:p-2 text-center font-medium text-xs border-b border-border cursor-pointer hover:bg-muted/50 transition-colors", isDayToday && "bg-primary/10", isDayClosed && "bg-red-500/10")} onClick={() => {
              setCurrentDate(day);
              setViewMode('day');
            }}>
                    <span className={cn("font-bold", isDayToday && "text-primary", isDayClosed && "text-red-500")}>
                      {format(day, 'EEEE d MMM', {
                  locale: pl
                })}
                      {isDayClosed && <span className="text-xs ml-1">(zamknięte)</span>}
                    </span>
                  </div>
                  {/* Station headers for this day */}
                  <div className="flex">
                    {visibleStations.map((station, stationIdx) => <div key={`${dayStr}-${station.id}`} className={cn("flex-1 p-1 md:p-2 text-center font-medium text-[10px] md:text-xs min-w-[60px]", stationIdx < visibleStations.length - 1 && "border-r border-border")}>
                        <div className="text-foreground truncate">{station.name}</div>
                      </div>)}
                  </div>
                </div>;
        })}
          </div>

          {/* Calendar Grid - Two Days View */}
          <div className="flex-1 overflow-auto">
            <div className="flex relative" style={{
          minHeight: (DISPLAY_END_TIME - DISPLAY_START_TIME) * HOUR_HEIGHT
        }}>
              {/* Time column */}
              <div className="w-10 md:w-16 shrink-0 border-r border-border bg-muted/10">
                {HOURS.map((hour, hourIndex) => {
              // Calculate which slots to show for this hour
              const isFirstHour = hourIndex === 0;
              const isLastHour = hourIndex === HOURS.length - 1;
              const slotsToSkip = isFirstHour ? START_SLOT_OFFSET : 0;
              const endSlotOffset = isLastHour ? Math.round((DISPLAY_END_TIME - hour) * SLOTS_PER_HOUR) : SLOTS_PER_HOUR;
              const slotsToRender = Math.max(0, endSlotOffset - slotsToSkip);
              if (slotsToRender <= 0) return null;
              return <div key={hour} className="relative" style={{
                height: slotsToRender * SLOT_HEIGHT
              }}>
                    {/* Only show hour label if we're showing the :00 slot */}
                    {slotsToSkip === 0 && <span className="absolute -top-2 right-1 md:right-2 text-[10px] md:text-xs text-foreground bg-background px-1 z-10">
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </span>}
                    {slotsToSkip > 0 && <span className="absolute -top-2 right-1 md:right-2 text-[10px] md:text-xs text-foreground bg-background px-1 z-10">
                        {`${hour.toString().padStart(2, '0')}:${(slotsToSkip * SLOT_MINUTES).toString().padStart(2, '0')}`}
                      </span>}
                    <div className="absolute left-0 right-0 top-0 h-full">
                      {Array.from({
                    length: slotsToRender
                  }, (_, i) => {
                    const actualSlotIndex = i + slotsToSkip;
                    return <div key={i} className={cn("border-b", actualSlotIndex === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40")} style={{
                      height: SLOT_HEIGHT
                    }} />;
                  })}
                    </div>
                  </div>;
            })}
              </div>

              {/* Day columns with stations */}
              {twoDays.map((day, dayIdx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isDayToday = isSameDay(day, new Date());
            const today = startOfDay(new Date());
            const dayDate = startOfDay(day);
            const isPastDay = isBefore(dayDate, today);
            return <div key={dayStr} className={cn("flex-1 flex", dayIdx < 1 && "border-r-2 border-border")}>
                    {visibleStations.map((station, stationIdx) => {
                // Get hours info for this specific day
                const dayHours = getHoursForDate(day);
                const totalVisibleHeight = (dayHours.displayEndTime - dayHours.displayStartTime) * HOUR_HEIGHT;

                // Calculate past hatch height for this day (relative to displayStartTime)
                // Only hatch past days, NOT elapsed time in today
                let pastHatchHeight = 0;
                if (isPastDay) {
                  pastHatchHeight = totalVisibleHeight;
                }
                return <div key={`${dayStr}-${station.id}`} className={cn("flex-1 relative min-w-[60px] transition-colors duration-150", stationIdx < visibleStations.length - 1 && "border-r border-border", isDayToday && "bg-primary/5", dragOverStation === station.id && dragOverDate === dayStr && !dragOverSlot && "bg-primary/10")} onDragOver={e => handleDragOver(e, station.id, dayStr)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, station.id, dayStr)}>
                        {/* Hatched area for CLOSED DAY (covers entire column) */}
                        {dayHours.isClosed && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-10" style={{
                    height: totalVisibleHeight
                  }} />}
                        
                        {/* Hatched area for PAST time slots */}
                        {!dayHours.isClosed && pastHatchHeight > 0 && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-10" style={{
                    height: pastHatchHeight
                  }} />}
                        
                        {/* Hatched area BEFORE working hours (exactly 30 min margin) */}
                        {!dayHours.isClosed && dayHours.displayStartTime < dayHours.workingStartTime && <div className="absolute left-0 right-0 hatched-pattern pointer-events-none z-5" style={{
                    top: 0,
                    height: (dayHours.workingStartTime - dayHours.displayStartTime) * HOUR_HEIGHT
                  }} />}
                        
                        {/* Hatched area AFTER working hours (exactly 30 min margin) */}
                        {!dayHours.isClosed && dayHours.displayEndTime > dayHours.workingEndTime && <div className="absolute left-0 right-0 hatched-pattern pointer-events-none z-5" style={{
                    top: (dayHours.workingEndTime - dayHours.displayStartTime) * HOUR_HEIGHT,
                    height: (dayHours.displayEndTime - dayHours.workingEndTime) * HOUR_HEIGHT
                  }} />}
                        {/* 15-minute grid slots */}
                        {HOURS.map((hour, hourIndex) => {
                    const isFirstHour = hourIndex === 0;
                    const isLastHour = hourIndex === HOURS.length - 1;
                    const slotsToSkip = isFirstHour ? START_SLOT_OFFSET : 0;
                    const endSlotOffset = isLastHour ? Math.round((DISPLAY_END_TIME - hour) * SLOTS_PER_HOUR) : SLOTS_PER_HOUR;
                    const slotsToRender = Math.max(0, endSlotOffset - slotsToSkip);
                    if (slotsToRender <= 0) return null;
                    return <div key={hour} style={{
                      height: slotsToRender * SLOT_HEIGHT
                    }}>
                            {Array.from({
                        length: slotsToRender
                      }, (_, i) => {
                        const slotIndex = i + slotsToSkip;
                        const slotMinutes = slotIndex * SLOT_MINUTES;
                        const slotTimeDecimal = hour + slotMinutes / 60;
                        const isDropTarget = dragOverStation === station.id && dragOverDate === dayStr && dragOverSlot?.hour === hour && dragOverSlot?.slotIndex === slotIndex;

                        // Check if this slot is outside working hours (in hatched area)
                        const isOutsideWorkingHours = slotTimeDecimal < dayHours.workingStartTime || slotTimeDecimal >= dayHours.workingEndTime;

                        // Disable only for past days (not today's past hours) OR outside working hours OR day is closed
                        // Today's earlier hours remain clickable for admin flexibility
                        const isDayClosedInDb = isDateClosed(dayStr);
                        const isDisabled = isPastDay || isOutsideWorkingHours || isDayClosedInDb || dayHours.isClosed;
                        return <div key={slotIndex} className={cn("border-b group transition-colors", slotIndex % 3 === 0 && "border-border/50", slotIndex % 3 !== 0 && "border-border/20", isDropTarget && !isDisabled && "bg-primary/30 border-primary", !isDropTarget && !isDisabled && "hover:bg-primary/5 cursor-pointer", isDisabled && "cursor-not-allowed")} style={{
                          height: SLOT_HEIGHT
                        }} onClick={() => !isDisabled && handleSlotClick(station.id, hour, slotIndex, dayStr)} onContextMenu={e => !isDisabled && handleSlotContextMenu(e, station.id, hour, slotIndex, dayStr)} onTouchStart={() => !isDisabled && handleTouchStart(station.id, hour, slotIndex, dayStr)} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} onDragOver={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isDisabled) handleSlotDragOver(e, station.id, hour, slotIndex, dayStr);
                        }} onDrop={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isDisabled) handleDrop(e, station.id, dayStr, hour, slotIndex);
                        }}>
                                  {/* Hide + on hover in hallMode or disabled slots */}
                                  {!hallMode && !isDisabled && <div className="h-full w-full flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus className="w-2 h-2 text-primary/50" />
                                      <span className="text-[8px] text-primary/70">{`${hour.toString().padStart(2, '0')}:${(slotIndex * SLOT_MINUTES).toString().padStart(2, '0')}`}</span>
                                    </div>}
                                </div>;
                      })}
                          </div>;
                  })}

                        {/* Drag preview ghost */}
                        {draggedReservation && dragOverStation === station.id && dragOverDate === dayStr && dragPreviewStyle && <div className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none flex items-center justify-center" style={{
                    top: dragPreviewStyle.top,
                    height: dragPreviewStyle.height,
                    zIndex: 10000
                  }}>
                            <span className="text-[10px] font-bold text-foreground bg-background px-2 py-1 rounded-md shadow-lg border border-border">
                              Przenieś na {dragPreviewStyle.time}
                            </span>
                          </div>}

                        {/* Slot Preview Highlight */}
                        {slotPreview && 
                         slotPreview.date === dayStr && 
                         slotPreview.stationId === station.id && (
                          <div 
                            className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-fuchsia-400 pointer-events-none z-40 animate-pulse"
                            style={{
                              ...getReservationStyle(slotPreview.startTime, slotPreview.endTime, dayHours.displayStartTime),
                              background: 'repeating-linear-gradient(45deg, rgba(236,72,153,0.15), rgba(236,72,153,0.15) 4px, transparent 4px, transparent 8px)'
                            }}
                          >
                            <div className="px-2 py-1 text-xs font-medium text-fuchsia-600">
                              {slotPreview.startTime.slice(0,5)} - {slotPreview.endTime.slice(0,5)}
                            </div>
                          </div>
                        )}

                        {/* Reservations */}
                        {getReservationsForStationAndDate(station.id, dayStr).map(reservation => {
                    const {
                      displayStart,
                      displayEnd
                    } = getDisplayTimesForDate(reservation, dayStr);
                    const style = getReservationStyle(displayStart, displayEnd, dayHours.displayStartTime);
                    const isDragging = draggedReservation?.id === reservation.id;
                    const isMultiDay = reservation.end_date && reservation.end_date !== reservation.reservation_date;
                    return <div key={reservation.id} draggable={!hallMode} onDragStart={e => handleDragStart(e, reservation)} onDragEnd={handleDragEnd} className={cn("absolute left-0.5 right-0.5 rounded-lg border px-1 py-0.5", !hallMode && "cursor-grab active:cursor-grabbing", hallMode && "cursor-pointer", "transition-all duration-150 hover:shadow-lg hover:z-20", "overflow-hidden select-none", getStatusColor(reservation.status, reservation.station?.type || station.type), isDragging && "opacity-50 scale-95")} style={style} onClick={e => {
                      e.stopPropagation();
                      onReservationClick?.(reservation);
                    }}>
                              {/* Drag handle - hidden in hallMode */}
                              <div className={cn(!hallMode && "pl-3")}>
                                <div className="flex items-center justify-between gap-0.5">
                                  {/* In hallMode show time instead of name */}
                                  {hallMode ? <div className="text-[10px] md:text-xs font-bold truncate">
                                      {isMultiDay ? `${displayStart.slice(0, 5)} - ${displayEnd.slice(0, 5)}` : `${reservation.start_time.slice(0, 5)} - ${reservation.end_time.slice(0, 5)}`}
                                    </div> : <div className="flex items-center gap-0.5 text-[9px] md:text-[10px] font-semibold truncate">
                                      <User className="w-2.5 h-2.5 shrink-0" />
                                      {reservation.customer_name}
                                    </div>}
                                  {/* Hide phone in hallMode */}
                                  {!hallMode && reservation.customer_phone && <a href={`tel:${reservation.customer_phone}`} onClick={e => e.stopPropagation()} className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors" title={reservation.customer_phone}>
                                      <Phone className="w-4 h-4" />
                                    </a>}
                                </div>
                                {reservation.vehicle_plate && <div className="flex items-center gap-0.5 text-[9px] md:text-[10px] truncate opacity-90">
                                    <Car className="w-2.5 h-2.5 shrink-0" />
                                    {reservation.vehicle_plate}
                                  </div>}
                                {/* Hide time row in hallMode */}
                                {!hallMode && <div className="text-[9px] truncate opacity-80 mt-0.5 hidden md:block flex items-center gap-1">
                                    {isMultiDay ? `${displayStart.slice(0, 5)} - ${displayEnd.slice(0, 5)}` : `${reservation.start_time.slice(0, 5)} - ${reservation.end_time.slice(0, 5)}`}
                                    {reservation.status === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse-dot shrink-0" />}
                                    {reservation.status === 'change_requested' && <RefreshCw className="w-2.5 h-2.5 text-orange-600 shrink-0" />}
                                  </div>}
                              </div>
                            </div>;
                  })}
                      </div>;
              })}
                  </div>;
          })}

              {/* Current time indicator */}
              {twoDays.some(d => isSameDay(d, new Date())) && currentHour >= 8 && currentHour <= 18 && <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{
            top: currentTimeTop
          }}>
                  <div className="flex items-center">
                    <div className="w-14 md:w-16 flex justify-end pr-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                </div>}
            </div>
          </div>
        </>}

      {/* WEEK VIEW */}
      {viewMode === 'week' && <>
          {/* Week Day Headers */}
          <div className="flex border-b border-border bg-muted/20">
            {/* Time column header */}
            <div className="w-16 md:w-20 shrink-0 p-2 flex items-center justify-center border-r border-border">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            
            {/* Day headers */}
            {weekDays.map((day, idx) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isDayToday = isSameDay(day, new Date());
          const isDayClosed = isDateClosed(dayStr);
          const selectedStationId = weekViewStationId || stations[0]?.id;
          const dayReservations = selectedStationId ? getReservationsForStationAndDate(selectedStationId, dayStr) : [];
          return <div key={dayStr} className={cn("flex-1 p-2 md:p-3 text-center font-medium text-xs md:text-sm min-w-[80px] cursor-pointer hover:bg-muted/50 transition-colors", idx < 6 && "border-r border-border", isDayToday && "bg-primary/10", isDayClosed && "bg-red-500/10")} onClick={() => {
            setCurrentDate(day);
            setViewMode('day');
          }}>
                  <div className={cn("text-foreground", isDayToday && "text-primary font-bold", isDayClosed && "text-red-500")}>
                    {format(day, 'EEEE', {
                locale: pl
              })}
                  </div>
                  <div className={cn("text-lg font-bold", isDayToday && "text-primary", isDayClosed && "text-red-500")}>
                    {format(day, 'd')}
                  </div>
                  <div className={cn("text-xs", isDayClosed ? "text-red-500" : "text-muted-foreground")}>
                    {isDayClosed ? "zamknięte" : `${dayReservations.length} rez.`}
                  </div>
                </div>;
        })}
          </div>

          {/* Calendar Grid - Week View with single station */}
          <div className="flex-1 overflow-auto">
            <div className="flex relative" style={{
          minHeight: (DISPLAY_END_TIME - DISPLAY_START_TIME) * HOUR_HEIGHT
        }}>
              {/* Time column */}
              <div className="w-16 md:w-20 shrink-0 border-r border-border bg-muted/10">
                {HOURS.map((hour, hourIndex) => {
              // Calculate which slots to show for this hour
              const isFirstHour = hourIndex === 0;
              const isLastHour = hourIndex === HOURS.length - 1;
              const slotsToSkip = isFirstHour ? START_SLOT_OFFSET : 0;
              const endSlotOffset = isLastHour ? Math.round((DISPLAY_END_TIME - hour) * SLOTS_PER_HOUR) : SLOTS_PER_HOUR;
              const slotsToRender = Math.max(0, endSlotOffset - slotsToSkip);
              if (slotsToRender <= 0) return null;
              return <div key={hour} className="relative" style={{
                height: slotsToRender * SLOT_HEIGHT
              }}>
                    {slotsToSkip === 0 && <span className="absolute -top-2 right-1 md:right-2 text-[10px] md:text-xs text-foreground bg-background px-1 z-10">
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </span>}
                    {slotsToSkip > 0 && <span className="absolute -top-2 right-1 md:right-2 text-[10px] md:text-xs text-foreground bg-background px-1 z-10">
                        {`${hour.toString().padStart(2, '0')}:${(slotsToSkip * SLOT_MINUTES).toString().padStart(2, '0')}`}
                      </span>}
                    <div className="absolute left-0 right-0 top-0 h-full">
                      {Array.from({
                    length: slotsToRender
                  }, (_, i) => {
                    const actualSlotIndex = i + slotsToSkip;
                    return <div key={i} className={cn("border-b", actualSlotIndex === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40")} style={{
                      height: SLOT_HEIGHT
                    }} />;
                  })}
                    </div>
                  </div>;
            })}
              </div>

              {/* Day columns for selected station */}
              {weekDays.map((day, idx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isDayToday = isSameDay(day, new Date());
            const isDayClosed = isDateClosed(dayStr);
            const selectedStationId = weekViewStationId || stations[0]?.id;
            const dayReservations = selectedStationId ? getReservationsForStationAndDate(selectedStationId, dayStr) : [];
            const dayBreaks = selectedStationId ? getBreaksForStationAndDate(selectedStationId, dayStr) : [];
            const dayHours = getHoursForDate(day);
            const totalVisibleHeight = (dayHours.displayEndTime - dayHours.displayStartTime) * HOUR_HEIGHT;

            // Calculate past hatch height (relative to displayStartTime)
            // Only hatch past days - today should NOT be hatched at all
            const today = startOfDay(new Date());
            const dayDate = startOfDay(day);
            const isPastDay = isBefore(dayDate, today);
            let pastHatchHeight = 0;
            if (isPastDay) {
              pastHatchHeight = totalVisibleHeight;
            }
            // Today is NOT hatched - we want to allow adding reservations to any time slot

            return <div key={dayStr} className={cn("flex-1 relative min-w-[80px]", idx < 6 && "border-r border-border", isDayToday && "bg-primary/5", isDayClosed && "bg-red-500/5")} onDragOver={e => selectedStationId && handleDragOver(e, selectedStationId, dayStr)} onDragLeave={handleDragLeave} onDrop={e => selectedStationId && handleDrop(e, selectedStationId, dayStr)}>
                    {/* Hatched area for PAST time slots */}
                    {pastHatchHeight > 0 && !isDayClosed && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-10" style={{
                height: pastHatchHeight
              }} />}
                    
                    {/* Hatched area BEFORE working hours - from global start to day's working start */}
                    {!isDayClosed && dayHours.workingStartTime > DISPLAY_START_TIME && <div className="absolute left-0 right-0 hatched-pattern pointer-events-none z-5" style={{
                top: 0,
                height: (dayHours.workingStartTime - DISPLAY_START_TIME) * HOUR_HEIGHT
              }} />}
                    
                    {/* Hatched area AFTER working hours - extend to match the global display end time */}
                    {!isDayClosed && DISPLAY_END_TIME > dayHours.workingEndTime && <div className="absolute left-0 right-0 hatched-pattern pointer-events-none z-5" style={{
                top: (dayHours.workingEndTime - DISPLAY_START_TIME) * HOUR_HEIGHT,
                height: (DISPLAY_END_TIME - dayHours.workingEndTime) * HOUR_HEIGHT
              }} />}
                    
                    {/* Closed day overlay */}
                    {isDayClosed && <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className="bg-red-500/10 absolute inset-0" />
                        <div className="relative bg-red-500/80 text-white px-3 py-1.5 rounded-lg shadow text-xs flex items-center gap-1">
                          <CalendarOff className="w-3 h-3" />
                          <span>Zamknięte</span>
                        </div>
                      </div>}

                    {/* Hour grid slots */}
                    {HOURS.map((hour, hourIndex) => {
                const isFirstHour = hourIndex === 0;
                const isLastHour = hourIndex === HOURS.length - 1;
                const slotsToSkip = isFirstHour ? START_SLOT_OFFSET : 0;
                const endSlotOffset = isLastHour ? Math.round((DISPLAY_END_TIME - hour) * SLOTS_PER_HOUR) : SLOTS_PER_HOUR;
                const slotsToRender = Math.max(0, endSlotOffset - slotsToSkip);
                if (slotsToRender <= 0) return null;
                return <div key={hour} style={{
                  height: slotsToRender * SLOT_HEIGHT
                }}>
                        {Array.from({
                    length: slotsToRender
                  }, (_, i) => {
                    const slotIndex = i + slotsToSkip;
                    const slotMinutes = slotIndex * SLOT_MINUTES;
                    const slotTimeDecimal = hour + slotMinutes / 60;
                    const isDropTarget = selectedStationId && dragOverStation === selectedStationId && dragOverDate === dayStr && dragOverSlot?.hour === hour && dragOverSlot?.slotIndex === slotIndex;

                    // Check if this slot is outside working hours (in hatched area)
                    const isOutsideWorkingHours = slotTimeDecimal < dayHours.workingStartTime || slotTimeDecimal >= dayHours.workingEndTime;

                    // Disable only for past days (not today) OR outside working hours OR day is closed
                    // Today's earlier hours should remain clickable!
                    const isDisabled = isPastDay || isOutsideWorkingHours || isDayClosed;
                    return <div key={slotIndex} className={cn("border-b group transition-colors", slotIndex % 2 === 0 && "border-border/50", slotIndex % 2 !== 0 && "border-border/20", isDropTarget && !isDisabled && "bg-primary/30 border-primary", !isDropTarget && !isDisabled && "hover:bg-primary/5 cursor-pointer", isDisabled && "cursor-not-allowed")} style={{
                      height: SLOT_HEIGHT
                    }} onClick={() => !isDisabled && selectedStationId && handleSlotClick(selectedStationId, hour, slotIndex, dayStr)} onContextMenu={e => !isDisabled && selectedStationId && handleSlotContextMenu(e, selectedStationId, hour, slotIndex, dayStr)} onTouchStart={() => !isDisabled && selectedStationId && handleTouchStart(selectedStationId, hour, slotIndex, dayStr)} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} onDragOver={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isDisabled && selectedStationId) handleSlotDragOver(e, selectedStationId, hour, slotIndex, dayStr);
                    }} onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isDisabled && selectedStationId) handleDrop(e, selectedStationId, dayStr, hour, slotIndex);
                    }}>
                              {!hallMode && !isDisabled && <div className="h-full w-full flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Plus className="w-2 h-2 text-primary/50" />
                                  <span className="text-[8px] text-primary/70">{`${hour.toString().padStart(2, '0')}:${(slotIndex * SLOT_MINUTES).toString().padStart(2, '0')}`}</span>
                                </div>}
                            </div>;
                  })}
                      </div>;
              })}

                    {/* Drag preview ghost */}
                    {selectedStationId && draggedReservation && dragOverStation === selectedStationId && dragOverDate === dayStr && dragPreviewStyle && <div className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none z-10 flex items-center justify-center" style={{
                top: dragPreviewStyle.top,
                height: dragPreviewStyle.height
              }}>
                        <span className="text-[9px] font-semibold text-primary bg-background/80 px-1 py-0.5 rounded">
                          {dragPreviewStyle.time}
                        </span>
                      </div>}

                    {/* Slot Preview Highlight */}
                    {slotPreview && 
                     slotPreview.date === dayStr && 
                     slotPreview.stationId === selectedStationId && (
                      <div 
                        className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-fuchsia-400 pointer-events-none z-40 animate-pulse"
                        style={{
                          ...getReservationStyle(slotPreview.startTime, slotPreview.endTime, dayHours.displayStartTime),
                          background: 'repeating-linear-gradient(45deg, rgba(236,72,153,0.15), rgba(236,72,153,0.15) 4px, transparent 4px, transparent 8px)'
                        }}
                      >
                        <div className="px-2 py-1 text-xs font-medium text-fuchsia-600">
                          {slotPreview.startTime.slice(0,5)} - {slotPreview.endTime.slice(0,5)}
                        </div>
                      </div>
                    )}

                    {/* Reservations */}
                    {dayReservations.map(reservation => {
                const {
                  displayStart,
                  displayEnd
                } = getDisplayTimesForDate(reservation, dayStr);
                const style = getReservationStyle(displayStart, displayEnd, dayHours.displayStartTime);
                const isDragging = draggedReservation?.id === reservation.id;
                const isMultiDay = reservation.end_date && reservation.end_date !== reservation.reservation_date;
                const selectedStation = stations.find(s => s.id === selectedStationId);
                return <div key={reservation.id} draggable={!hallMode && !readOnly} onDragStart={e => handleDragStart(e, reservation)} onDragEnd={handleDragEnd} className={cn("absolute left-0.5 right-0.5 rounded-lg border-l-4 px-1 md:px-2 py-0.5 md:py-1", !hallMode && !readOnly && "cursor-grab active:cursor-grabbing", hallMode && "cursor-pointer", "transition-all duration-150 hover:shadow-lg hover:z-20", "overflow-hidden select-none", getStatusColor(reservation.status, selectedStation?.type), isDragging && "opacity-50 scale-95")} style={style} onClick={e => {
                  e.stopPropagation();
                  onReservationClick?.(reservation);
                }}>
                          {/* Drag handle */}
                          <div className={cn(!hallMode && !readOnly && "pl-2")}>
                            <div className="flex items-center justify-between gap-0.5">
                              {hallMode ? <div className="text-[9px] md:text-[10px] font-bold truncate">
                                  {isMultiDay ? `${displayStart.slice(0, 5)} - ${displayEnd.slice(0, 5)}` : `${reservation.start_time.slice(0, 5)} - ${reservation.end_time.slice(0, 5)}`}
                                </div> : <div className="flex items-center gap-0.5 text-[9px] md:text-[10px] font-semibold truncate">
                                  <User className="w-2.5 h-2.5 shrink-0" />
                                  {reservation.customer_name}
                                </div>}
                              {!hallMode && reservation.customer_phone && <a href={`tel:${reservation.customer_phone}`} onClick={e => e.stopPropagation()} className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors" title={reservation.customer_phone}>
                                  <Phone className="w-3 h-3" />
                                </a>}
                            </div>
                            {reservation.vehicle_plate && <div className="flex items-center gap-0.5 text-[8px] md:text-[9px] opacity-90 truncate">
                                <Car className="w-2 h-2 shrink-0" />
                                <span className="truncate">{reservation.vehicle_plate}</span>
                                {!hallMode && <span className="opacity-80 shrink-0 ml-0.5 flex items-center gap-0.5">
                                    {isMultiDay ? `${displayStart.slice(0, 5)}` : reservation.start_time.slice(0, 5)}
                                    {reservation.status === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse-dot" />}
                                    {reservation.status === 'change_requested' && <RefreshCw className="w-2.5 h-2.5 text-orange-600" />}
                                  </span>}
                              </div>}
                            {reservation.service && <div className="text-[8px] md:text-[9px] opacity-70 truncate">
                                {reservation.service.shortcut || reservation.service.name}
                              </div>}
                          </div>
                        </div>;
              })}

                    {/* Breaks */}
                    {dayBreaks.map(breakItem => {
                const style = getReservationStyle(breakItem.start_time, breakItem.end_time, dayHours.displayStartTime);
                return <div key={breakItem.id} className="absolute left-0.5 right-0.5 rounded-lg border-l-4 px-1 md:px-2 py-0.5 bg-slate-500/80 border-slate-600 text-white overflow-hidden group" style={style}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-semibold truncate">
                              <Coffee className="w-2.5 h-2.5 shrink-0" />
                              {t('calendar.break')}
                            </div>
                            {!readOnly && <button onClick={e => {
                      e.stopPropagation();
                      onDeleteBreak?.(breakItem.id);
                    }} className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100" title={t('calendar.deleteBreak')}>
                                <X className="w-2.5 h-2.5" />
                              </button>}
                          </div>
                          <div className="text-[8px] md:text-[9px] truncate opacity-80">
                            {breakItem.start_time.slice(0, 5)} - {breakItem.end_time.slice(0, 5)}
                          </div>
                        </div>;
              })}
                  </div>;
          })}

              {/* Current time indicator */}
              {weekDays.some(d => isSameDay(d, new Date())) && showCurrentTime && <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{
            top: currentTimeTop
          }}>
                  <div className="flex items-center">
                    <div className="w-16 md:w-20 flex justify-end pr-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                </div>}
            </div>
          </div>
        </>}

      {/* Color Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4 pb-2 border-t border-border/50 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-400/80 border border-amber-500/70" />
          <span className="text-xs text-muted-foreground">Do potwierdzenia</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-400/80 border border-orange-500/70" />
          <span className="text-xs text-muted-foreground">Prośba o zmianę</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-400/80 border border-green-500/70" />
          <span className="text-xs text-muted-foreground">Potwierdzony</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-sky-300/80 border border-sky-400/70" />
          <span className="text-xs text-muted-foreground">Gotowy do wydania</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-400/80 border border-slate-500/70" />
          <span className="text-xs text-muted-foreground">Wydany</span>
        </div>
      </div>

      {/* Plac Sheet - from right side, no overlay, non-modal for drag & drop */}
      <Sheet open={placDrawerOpen} onOpenChange={setPlacDrawerOpen} modal={false}>
        <SheetContent side="right" hideOverlay className="w-[20%] min-w-[280px] bg-white border-l border-border shadow-[-8px_0_30px_-10px_rgba(0,0,0,0.15)] p-0 [&>button]:hidden" onInteractOutside={e => e.preventDefault()} onFocusOutside={(e) => e.preventDefault()}>
          <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3 space-y-0">
            <SheetTitle className="text-lg font-semibold text-slate-900">Plac</SheetTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-900" onClick={() => setPlacDrawerOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          {instanceId && <YardVehiclesList instanceId={instanceId} hallMode={hallMode} />}
        </SheetContent>
      </Sheet>

      {/* SMS Dialog */}
      {smsDialogData && <SendSmsDialog open={smsDialogOpen} onClose={() => {
      setSmsDialogOpen(false);
      setSmsDialogData(null);
    }} phone={smsDialogData.phone} customerName={smsDialogData.customerName} instanceId={instanceId || null} />}

    </div>;
};
export default AdminCalendar;