import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, X, CalendarIcon, Clock, AlertTriangle, Plus, ClipboardPaste } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format, addDays, subDays, isSameDay, isBefore, startOfDay } from 'date-fns';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import ClientSearchAutocomplete from '@/components/ui/client-search-autocomplete';
import { pl } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneMaskedInput } from '@/components/ui/phone-masked-input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { sendPushNotification, formatDateForPush } from '@/lib/pushNotifications';
import ServiceSelectionDrawer from './ServiceSelectionDrawer';

type CarSize = 'small' | 'medium' | 'large';
type DialogMode = 'reservation' | 'yard' | 'ppf' | 'detailing';

interface Service {
  id: string;
  name: string;
  shortcut?: string | null;
  duration_minutes: number | null;
  duration_small: number | null;
  duration_medium: number | null;
  duration_large: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  station_type: string | null;
  is_popular?: boolean | null;
}

interface CustomerVehicle {
  id: string;
  phone: string;
  model: string;
  plate: string | null;
  customer_id: string | null;
  customer_name?: string;
  car_size?: string | null;
  last_used_at?: string | null;
}

interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

interface Station {
  id: string;
  name: string;
  type: string;
}

interface AvailabilityBlock {
  block_date: string;
  start_time: string;
  end_time: string;
  station_id: string;
}

interface WorkingHours {
  open: string;
  close: string;
}

interface TimeSlot {
  time: string;
  availableStationIds: string[];
  overlapType: 'none' | 'single' | 'double';
  overlapMinutes: number;
}

const OVERLAP_TOLERANCE = 15; // maksymalny akceptowalny overlap w minutach na jeden kierunek

interface EditingReservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size?: CarSize | null;
  reservation_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  station_id: string | null;
  service_ids?: string[];
  service_id?: string;
  customer_notes?: string | null;
  admin_notes?: string | null;
  price?: number | null;
  confirmation_code?: string;
}

export interface YardVehicle {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size: CarSize | null;
  service_ids: string[];
  arrival_date: string;
  pickup_date: string | null;
  deadline_time: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface AddReservationDialogV2Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  onSuccess: () => void;
  workingHours?: Record<string, WorkingHours | null> | null;
  /** Optional reservation to edit - when provided, dialog works in edit mode */
  editingReservation?: EditingReservation | null;
  /** Mode: reservation (washing), yard, ppf, detailing */
  mode?: DialogMode;
  /** Station ID for ppf/detailing modes */
  stationId?: string;
  /** Yard vehicle to edit when mode='yard' */
  editingYardVehicle?: YardVehicle | null;
  /** Initial date from slot click - sets manual mode */
  initialDate?: string;
  /** Initial time from slot click - sets manual mode */
  initialTime?: string;
  /** Initial station from slot click - sets manual mode */
  initialStationId?: string;
  /** Callback for live slot preview on calendar */
  onSlotPreviewChange?: (preview: {
    date: string;
    startTime: string;
    endTime: string;
    stationId: string;
  } | null) => void;
}

const SLOT_INTERVAL = 15;
const MIN_LEAD_TIME_MINUTES = 15;

const AddReservationDialogV2 = ({
  open,
  onClose,
  instanceId,
  onSuccess,
  workingHours = null,
  editingReservation = null,
  mode = 'reservation',
  stationId: propStationId,
  editingYardVehicle = null,
  initialDate,
  initialTime,
  initialStationId,
  onSlotPreviewChange,
}: AddReservationDialogV2Props) => {
  const isYardMode = mode === 'yard';
  const isPPFMode = mode === 'ppf';
  const isDetailingMode = mode === 'detailing';
  const isPPFOrDetailingMode = isPPFMode || isDetailingMode;
  const isReservationMode = mode === 'reservation';
  const isEditMode = isYardMode ? !!editingYardVehicle : !!editingReservation;
  
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  // Mobile: toggle drawer visibility to peek at calendar
  const [isDrawerHidden, setIsDrawerHidden] = useState(false);
const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [foundVehicles, setFoundVehicles] = useState<CustomerVehicle[]>([]);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Ref to suppress phone search after programmatic phone value set (edit mode)
  const suppressPhoneSearchRef = useRef(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize>('medium');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCustomCarModel, setIsCustomCarModel] = useState(false);
  const [customerDiscountPercent, setCustomerDiscountPercent] = useState<number | null>(null);
  
  // Customer vehicles pills state
  const [customerVehicles, setCustomerVehicles] = useState<CustomerVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Date picker
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  // Services dropdown
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  
  const slotsScrollRef = useRef<HTMLDivElement>(null);

  // Manual time selection mode (for reservation mode only)
  const [timeSelectionMode, setTimeSelectionMode] = useState<'slots' | 'manual'>('manual');
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  
  // Edit mode: time change flow
  const [isChangingTime, setIsChangingTime] = useState(false);
  const [originalDate, setOriginalDate] = useState<Date | null>(null);
  const [originalTime, setOriginalTime] = useState<string | null>(null);
  const [originalStationId, setOriginalStationId] = useState<string | null>(null);
  const [originalManualStartTime, setOriginalManualStartTime] = useState<string>('');
  const [originalManualEndTime, setOriginalManualEndTime] = useState<string>('');
  const [originalManualStationId, setOriginalManualStationId] = useState<string | null>(null);
  const [originalTimeSelectionMode, setOriginalTimeSelectionMode] = useState<'slots' | 'manual'>('manual');
  const [manualStationId, setManualStationId] = useState<string | null>(null);
  
  // Track the last totalDurationMinutes to detect changes
  const prevTotalDurationRef = useRef<number>(0);

  // Yard mode state
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date());
  const [arrivalDateOpen, setArrivalDateOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [pickupDateOpen, setPickupDateOpen] = useState(false);
  const [deadlineTime, setDeadlineTime] = useState('');

  // PPF/Detailing mode state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [ppfStartTime, setPpfStartTime] = useState('09:00');
  const [ppfEndTime, setPpfEndTime] = useState('17:00');
  const [offerNumber, setOfferNumber] = useState('');

  // Get station type for service filtering
  const getStationType = (): 'washing' | 'ppf' | 'detailing' | 'universal' => {
    if (mode === 'ppf') return 'ppf';
    if (mode === 'detailing') return 'detailing';
    return 'washing';
  };

  // Fetch services and stations on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;
      
      const stationType = getStationType();
      
      // For yard/detailing mode, fetch ALL services (no filter)
      // For PPF mode, filter by station_type='ppf'
      // For reservation mode, filter by station_type='washing'
      let servicesQuery = supabase
        .from('services')
        .select('id, name, shortcut, duration_minutes, duration_small, duration_medium, duration_large, price_from, price_small, price_medium, price_large, station_type, is_popular')
        .eq('instance_id', instanceId)
        .eq('active', true);
      
      // All services available in all modes - no station_type filtering
      
      const { data: servicesData } = await servicesQuery.order('sort_order');
      
      if (servicesData) {
        setServices(servicesData);
      }
      
      // Fetch all active stations (for reservation mode)
      if (isReservationMode) {
        const { data: stationsData } = await supabase
          .from('stations')
          .select('id, name, type')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .order('sort_order');
        
        if (stationsData) {
          setStations(stationsData);
        }
      }
    };
    
    fetchData();
  }, [open, instanceId, mode]);

  // Stable date string to prevent refetching when Date object reference changes
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch availability blocks when date changes (only for reservation mode)
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!open || !instanceId || !selectedDateStr || !isReservationMode) return;
      
      const toDate = format(addDays(new Date(selectedDateStr), 7), 'yyyy-MM-dd');
      
      const { data } = await supabase.rpc('get_availability_blocks', {
        _instance_id: instanceId,
        _from: selectedDateStr,
        _to: toDate,
      });
      
      if (data) {
        setAvailabilityBlocks(data);
      }
    };
    
    fetchAvailability();
  }, [open, instanceId, selectedDateStr, isReservationMode]);

  // Calculate the next working day based on working hours
  const getNextWorkingDay = useCallback((): Date => {
    if (!workingHours) return new Date();
    
    const now = new Date();
    let checkDate = startOfDay(now);
    
    // Check if today is still a valid working day
    const todayName = format(now, 'EEEE').toLowerCase();
    const todayHours = workingHours[todayName];
    
    if (todayHours) {
      const [closeH, closeM] = todayHours.close.split(':').map(Number);
      const closeTime = new Date(now);
      closeTime.setHours(closeH, closeM, 0, 0);
      
      // If current time is before closing, today is valid
      if (isBefore(now, closeTime)) {
        return checkDate;
      }
    }
    
    // Find next working day
    for (let i = 1; i <= 7; i++) {
      checkDate = addDays(startOfDay(now), i);
      const dayName = format(checkDate, 'EEEE').toLowerCase();
      if (workingHours[dayName]) {
        return checkDate;
      }
    }
    
    return addDays(startOfDay(now), 1);
  }, [workingHours]);

  // Ref to track if dialog was already open (to distinguish first open vs slot change)
  const wasOpenRef = useRef(false);

  // Reset form when dialog opens or populate from editing data
  useEffect(() => {
    if (open) {
      if (isYardMode && editingYardVehicle) {
        // Yard edit mode
        suppressPhoneSearchRef.current = true;
        setCustomerName(editingYardVehicle.customer_name || '');
        setPhone(editingYardVehicle.customer_phone || '');
        setCarModel(editingYardVehicle.vehicle_plate || '');
        setCarSize(editingYardVehicle.car_size || 'medium');
        setSelectedServices(editingYardVehicle.service_ids || []);
        setArrivalDate(new Date(editingYardVehicle.arrival_date));
        setPickupDate(editingYardVehicle.pickup_date ? new Date(editingYardVehicle.pickup_date) : null);
        setDeadlineTime(editingYardVehicle.deadline_time || '');
        setAdminNotes(editingYardVehicle.notes || '');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
      } else if (isYardMode) {
        // Yard create mode
        setCustomerName('');
        setPhone('');
        setCarModel('');
        setCarSize('medium');
        setSelectedServices([]);
        setArrivalDate(new Date());
        setPickupDate(null);
        setDeadlineTime('');
        setAdminNotes('');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
      } else if (isPPFOrDetailingMode && editingReservation) {
        // PPF/Detailing edit mode
        suppressPhoneSearchRef.current = true;
        setCustomerName(editingReservation.customer_name || '');
        setPhone(editingReservation.customer_phone || '');
        setCarModel(editingReservation.vehicle_plate || '');
        setCarSize(editingReservation.car_size || 'medium');
        // Use service_ids if not empty, otherwise fallback to service_id
        const serviceIds = (editingReservation.service_ids && editingReservation.service_ids.length > 0) 
          ? editingReservation.service_ids 
          : (editingReservation.service_id ? [editingReservation.service_id] : []);
        setSelectedServices(serviceIds);
        
        // Date range
        const fromDate = new Date(editingReservation.reservation_date);
        const toDate = editingReservation.end_date ? new Date(editingReservation.end_date) : fromDate;
        setDateRange({ from: fromDate, to: toDate });
        
        setPpfStartTime(editingReservation.start_time?.substring(0, 5) || '09:00');
        setPpfEndTime(editingReservation.end_time?.substring(0, 5) || '17:00');
        
        // Use offer_number column directly (or fallback to parsing from admin_notes for legacy data)
        if ((editingReservation as any).offer_number) {
          setOfferNumber((editingReservation as any).offer_number);
          setAdminNotes(editingReservation.admin_notes || '');
        } else if (editingReservation.admin_notes) {
          // Fallback for legacy data with offer in notes
          const offerMatch = editingReservation.admin_notes.match(/Oferta:\s*([^\n]+)/);
          if (offerMatch) {
            setOfferNumber(offerMatch[1].trim());
            setAdminNotes(editingReservation.admin_notes.replace(/Oferta:\s*[^\n]+\n?/, '').trim());
          } else {
            setOfferNumber('');
            setAdminNotes(editingReservation.admin_notes);
          }
        } else {
          setOfferNumber('');
          setAdminNotes('');
        }
        
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
      } else if (isPPFOrDetailingMode) {
        // PPF/Detailing create mode
        setCustomerName('');
        setPhone('');
        setCarModel('');
        setCarSize('medium');
        setSelectedServices([]);
        // Set date range to initialDate (slot click) or today
        const slotDate = initialDate ? new Date(initialDate) : new Date();
        setDateRange({ from: slotDate, to: slotDate });
        setPpfStartTime('09:00');
        setPpfEndTime('17:00');
        setOfferNumber('');
        setAdminNotes('');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
      } else if (editingReservation) {
        // Reservation edit mode
        suppressPhoneSearchRef.current = true;
        setCustomerName(editingReservation.customer_name || '');
        setPhone(editingReservation.customer_phone || '');
        setCarModel(editingReservation.vehicle_plate || '');
        setCarSize(editingReservation.car_size || 'medium');
        // Use service_ids if not empty, otherwise fallback to service_id
        const serviceIds = (editingReservation.service_ids && editingReservation.service_ids.length > 0) 
          ? editingReservation.service_ids 
          : (editingReservation.service_id ? [editingReservation.service_id] : []);
        setSelectedServices(serviceIds);
        setSelectedDate(new Date(editingReservation.reservation_date));
        setSelectedTime(null); // Reset - will use editingReservation values in display
        setSelectedStationId(editingReservation.station_id);
        setAdminNotes(editingReservation.admin_notes || '');
        setFinalPrice(editingReservation.price?.toString() || '');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
        // Reset time change flow and set manual time from editing reservation
        setIsChangingTime(false);
        setTimeSelectionMode('manual');
        setManualStartTime(editingReservation.start_time?.substring(0, 5) || '');
        setManualEndTime(editingReservation.end_time?.substring(0, 5) || '');
        setManualStationId(editingReservation.station_id);
      } else if (initialDate && initialTime && initialStationId && !editingReservation) {
        // Slot click
        if (wasOpenRef.current) {
          // Dialog was already open - only update date/time/station, keep other data
          setSelectedDate(new Date(initialDate));
          setTimeSelectionMode('manual');
          setManualStartTime(initialTime);
          setManualStationId(initialStationId);
          // Recalculate end time based on current services duration
          // Note: totalDurationMinutes is calculated from selectedServices which we're keeping
          const currentDuration = selectedServices.reduce((total, serviceId) => {
            const service = services.find(s => s.id === serviceId);
            if (!service) return total;
            if (carSize === 'small' && service.duration_small) return total + service.duration_small;
            if (carSize === 'large' && service.duration_large) return total + service.duration_large;
            if (carSize === 'medium' && service.duration_medium) return total + service.duration_medium;
            return total + (service.duration_minutes || 60);
          }, 0);
          if (currentDuration > 0) {
            const [h, m] = initialTime.split(':').map(Number);
            const endMinutes = h * 60 + m + currentDuration;
            const newEndTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
            setManualEndTime(newEndTime);
          }
        } else {
          // First open - full reset with slot values
          setCustomerName('');
          setPhone('');
          setCarModel('');
          setCarSize('medium');
          setSelectedServices([]);
          setSelectedDate(new Date(initialDate));
          setSelectedTime(null);
          setSelectedStationId(null);
          setAdminNotes('');
          setFinalPrice('');
          setFoundCustomers([]);
          setSelectedCustomerId(null);
          setShowPhoneDropdown(false);
          setShowCustomerDropdown(false);
          setCustomerVehicles([]);
          setSelectedVehicleId(null);
          // Set manual mode with slot values
          setTimeSelectionMode('manual');
          setManualStartTime(initialTime);
          setManualEndTime('');
          setManualStationId(initialStationId);
        }
      } else {
        // Reservation create mode (FAB click)
        setCustomerName('');
        setPhone('');
        setCarModel('');
        setCarSize('medium');
        setSelectedServices([]);
        setSelectedDate(getNextWorkingDay());
        setSelectedTime(null);
        setSelectedStationId(null);
        setAdminNotes('');
        setFinalPrice('');
        setSelectedTime(null);
        setSelectedStationId(null);
        setAdminNotes('');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
        // Reset manual time mode
        setTimeSelectionMode('manual');
        setManualStartTime('');
        setManualEndTime('');
        setManualStationId(null);
      }
      // Track that dialog is now open
      wasOpenRef.current = true;
    } else {
      // Dialog closed - reset tracking ref
      wasOpenRef.current = false;
    }
  }, [open, getNextWorkingDay, editingReservation, isYardMode, isPPFOrDetailingMode, editingYardVehicle, initialDate, initialTime, initialStationId]);

  // Get duration for a service based on car size
  const getServiceDuration = (service: Service): number => {
    if (carSize === 'small' && service.duration_small) return service.duration_small;
    if (carSize === 'large' && service.duration_large) return service.duration_large;
    if (carSize === 'medium' && service.duration_medium) return service.duration_medium;
    return service.duration_minutes || 60;
  };

  // Calculate total duration from selected services
  const totalDurationMinutes = selectedServices.reduce((total, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return total + (service ? getServiceDuration(service) : 0);
  }, 0);

  // Get price for a service based on car size
  const getServicePrice = (service: Service): number => {
    if (carSize === 'small' && service.price_small) return service.price_small;
    if (carSize === 'large' && service.price_large) return service.price_large;
    if (carSize === 'medium' && service.price_medium) return service.price_medium;
    return service.price_from || 0;
  };

  // Calculate total price from selected services
  const totalPrice = selectedServices.reduce((total, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return total + (service ? getServicePrice(service) : 0);
  }, 0);

  // Auto-update manualEndTime when totalDurationMinutes increases and in manual mode
  useEffect(() => {
    if (!isReservationMode || timeSelectionMode !== 'manual' || !manualStartTime) {
      prevTotalDurationRef.current = totalDurationMinutes;
      return;
    }
    
    // Only update if duration increased and we have a start time
    if (totalDurationMinutes > 0 && manualStartTime) {
      const [h, m] = manualStartTime.split(':').map(Number);
      const startMinutes = h * 60 + m;
      const endMinutes = startMinutes + totalDurationMinutes;
      const newEndTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
      setManualEndTime(newEndTime);
    }
    
    prevTotalDurationRef.current = totalDurationMinutes;
  }, [totalDurationMinutes, manualStartTime, timeSelectionMode, isReservationMode]);

  // Emit slot preview for live calendar highlight
  useEffect(() => {
    if (!isReservationMode || !open || isEditMode) {
      onSlotPreviewChange?.(null);
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (timeSelectionMode === 'slots') {
      // Tab 1: Wybór ze slotów - use selectedTime + totalDurationMinutes
      if (selectedTime && selectedStationId && totalDurationMinutes > 0) {
        const [h, m] = selectedTime.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + totalDurationMinutes;
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
        
        onSlotPreviewChange?.({
          date: dateStr,
          startTime: selectedTime,
          endTime,
          stationId: selectedStationId
        });
      } else {
        onSlotPreviewChange?.(null);
      }
    } else if (timeSelectionMode === 'manual') {
      // Tab 2: Ustaw ręcznie
      if (manualStartTime && manualEndTime && manualStationId) {
        onSlotPreviewChange?.({
          date: dateStr,
          startTime: manualStartTime,
          endTime: manualEndTime,
          stationId: manualStationId
        });
      } else {
        onSlotPreviewChange?.(null);
      }
    }
  }, [
    open,
    isReservationMode,
    isEditMode,
    selectedDate,
    timeSelectionMode,
    // Slots mode
    selectedTime,
    selectedStationId,
    totalDurationMinutes,
    // Manual mode
    manualStartTime,
    manualEndTime,
    manualStationId,
    onSlotPreviewChange
  ]);

  // Get available time slots for the selected date (reservation mode only)
  // Now includes overlap slots for admin with ±15 min tolerance
  const getAvailableSlots = (): TimeSlot[] => {
    if (!workingHours || selectedServices.length === 0 || stations.length === 0 || !isReservationMode) {
      return [];
    }
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayName = format(selectedDate, 'EEEE').toLowerCase();
    const dayHours = workingHours[dayName];
    
    // Validate that day is enabled AND has valid open/close times
    if (!dayHours || !dayHours.open || !dayHours.close) return [];
    
    // Additional validation for proper time format
    if (!dayHours.open.includes(':') || !dayHours.close.includes(':')) return [];
    
    const parseTimeToMinutes = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    
    const [openH, openM] = dayHours.open.split(':').map(Number);
    const [closeH, closeM] = dayHours.close.split(':').map(Number);
    
    // Validate parsed values are numbers
    if (isNaN(openH) || isNaN(openM) || isNaN(closeH) || isNaN(closeM)) return [];
    
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    
    const dayBlocks = availabilityBlocks.filter(b => b.block_date === dateStr);
    
    let minStartTime = openMinutes;
    if (isSameDay(selectedDate, new Date())) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes() + MIN_LEAD_TIME_MINUTES;
      minStartTime = Math.max(openMinutes, Math.ceil(nowMinutes / SLOT_INTERVAL) * SLOT_INTERVAL);
    }
    
    const slots: TimeSlot[] = [];
    const slotMap = new Map<string, TimeSlot>();
    
    for (let time = minStartTime; time + totalDurationMinutes <= closeMinutes; time += SLOT_INTERVAL) {
      const timeStr = `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
      const slotStart = time;
      const slotEnd = time + totalDurationMinutes;
      
      for (const station of stations) {
        const stationBlocks = dayBlocks.filter(b => b.station_id === station.id);
        
        let totalOverlap = 0;
        let overlapDirections = 0;
        let hasExcessiveOverlap = false;
        
        for (const block of stationBlocks) {
          const blockStart = parseTimeToMinutes(block.start_time);
          const blockEnd = parseTimeToMinutes(block.end_time);
          
          // Sprawdź czy slot i blok się nakładają
          if (slotStart < blockEnd && slotEnd > blockStart) {
            const overlapStart = Math.max(slotStart, blockStart);
            const overlapEnd = Math.min(slotEnd, blockEnd);
            const overlap = overlapEnd - overlapStart;
            
            if (overlap > OVERLAP_TOLERANCE) {
              hasExcessiveOverlap = true;
              break;
            }
            
            if (overlap > 0) {
              totalOverlap += overlap;
              overlapDirections++;
            }
          }
        }
        
        // Akceptuj slot jeśli: brak overlap LUB overlap w tolerancji
        if (!hasExcessiveOverlap && totalOverlap <= OVERLAP_TOLERANCE * 2) {
          let overlapType: 'none' | 'single' | 'double' = 'none';
          if (totalOverlap > 0 && overlapDirections === 1) {
            overlapType = 'single'; // pomarańczowy
          } else if (totalOverlap > 0 && overlapDirections >= 2) {
            overlapType = 'double'; // czerwony
          }
          
          const existingSlot = slotMap.get(timeStr);
          if (existingSlot) {
            // Preferuj stanowisko z mniejszym overlapem
            if (totalOverlap < existingSlot.overlapMinutes) {
              slotMap.set(timeStr, {
                time: timeStr,
                availableStationIds: [station.id],
                overlapType,
                overlapMinutes: totalOverlap
              });
            } else if (totalOverlap === existingSlot.overlapMinutes) {
              existingSlot.availableStationIds.push(station.id);
            }
          } else {
            slotMap.set(timeStr, {
              time: timeStr,
              availableStationIds: [station.id],
              overlapType,
              overlapMinutes: totalOverlap
            });
          }
        }
      }
    }
    
    // Konwertuj mapę na tablicę i sortuj: najpierw zielone, potem pomarańczowe, na końcu czerwone
    const result = Array.from(slotMap.values());
    result.sort((a, b) => {
      const orderMap = { none: 0, single: 1, double: 2 };
      if (orderMap[a.overlapType] !== orderMap[b.overlapType]) {
        return orderMap[a.overlapType] - orderMap[b.overlapType];
      }
      return a.time.localeCompare(b.time);
    });
    
    return result;
  };

  const availableSlots = getAvailableSlots();

  // Handle slot selection
  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedTime(slot.time);
    setSelectedStationId(slot.availableStationIds[0]);
  };

  // Navigation
  const handlePrevDay = () => {
    const newDate = subDays(selectedDate, 1);
    if (!isBefore(newDate, startOfDay(new Date()))) {
      setSelectedDate(newDate);
      setSelectedTime(null);
    }
  };

  const handleNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
    setSelectedTime(null);
  };

  // Normalize phone: remove spaces and country code (+48, 0048, 48 at start)
  const normalizePhone = (phone: string): string => {
    let normalized = phone.replace(/\s+/g, '').replace(/[()-]/g, '');
    // Remove common Polish country code prefixes
    normalized = normalized.replace(/^\+48/, '').replace(/^0048/, '').replace(/^48(?=\d{9}$)/, '');
    return normalized;
  };

  // Search customer by phone (normalize by removing spaces and country code)
  const searchByPhone = useCallback(async (searchPhone: string) => {
    const normalizedSearch = normalizePhone(searchPhone);
    if (normalizedSearch.length < 3) {
      setFoundVehicles([]);
      setShowPhoneDropdown(false);
      return;
    }
    
    setSearchingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customer_vehicles')
        .select('id, phone, model, plate, customer_id')
        .eq('instance_id', instanceId)
        .or(`phone.ilike.%${normalizedSearch}%`)
        .order('last_used_at', { ascending: false })
        .limit(5);
      
      if (!error && data) {
        const customerIds = data.filter(v => v.customer_id).map(v => v.customer_id!);
        let customerNames: Record<string, string> = {};
        
        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', customerIds);
          
          if (customersData) {
            customersData.forEach(c => {
              customerNames[c.id] = c.name;
            });
          }
        }
        
        const vehiclesWithNames: CustomerVehicle[] = data.map(v => ({
          ...v,
          customer_name: v.customer_id ? customerNames[v.customer_id] : undefined
        }));
        
        setFoundVehicles(vehiclesWithNames);
        setShowPhoneDropdown(vehiclesWithNames.length > 0);
      }
    } finally {
      setSearchingCustomer(false);
    }
  }, [instanceId]);

  // Debounced phone search
  useEffect(() => {
    if (selectedCustomerId) return;
    
    // Skip search if suppressed (e.g. after programmatic value set in edit mode)
    if (suppressPhoneSearchRef.current) {
      suppressPhoneSearchRef.current = false;
      return;
    }
    
    const timer = setTimeout(() => {
      searchByPhone(phone);
    }, 300);
    return () => clearTimeout(timer);
  }, [phone, searchByPhone, selectedCustomerId]);

  // Load all vehicles for a phone number (for pills display)
  const loadCustomerVehicles = useCallback(async (phoneNumber: string) => {
    const normalized = normalizePhone(phoneNumber);
    if (normalized.length !== 9) {
      setCustomerVehicles([]);
      setSelectedVehicleId(null);
      return;
    }
    
    try {
      const { data } = await supabase
        .from('customer_vehicles')
        .select('id, phone, model, plate, customer_id, car_size, last_used_at')
        .eq('instance_id', instanceId)
        .or(`phone.eq.${normalized},phone.eq.+48${normalized}`)
        .order('last_used_at', { ascending: false });
      
      if (data && data.length > 0) {
        setCustomerVehicles(data);
        // Default select the first (most recently used)
        setSelectedVehicleId(data[0].id);
        // Auto-fill model from first vehicle
        setCarModel(data[0].model);
        // Set car size
        if (data[0].car_size === 'S') setCarSize('small');
        else if (data[0].car_size === 'L') setCarSize('large');
        else setCarSize('medium');
      } else {
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
      }
    } catch (err) {
      console.error('Failed to load customer vehicles:', err);
    }
  }, [instanceId]);

  // Effect to load vehicles when phone has 9 digits
  useEffect(() => {
    if (isEditMode) return; // Don't auto-load in edit mode
    
    const normalized = normalizePhone(phone);
    if (normalized.length === 9) {
      loadCustomerVehicles(phone);
    } else if (normalized.length < 9) {
      setCustomerVehicles([]);
      setSelectedVehicleId(null);
    }
  }, [phone, loadCustomerVehicles, isEditMode]);

  const selectVehicle = async (vehicle: CustomerVehicle) => {
    setPhone(vehicle.phone);
    setCarModel(vehicle.model);
    setShowPhoneDropdown(false);
    
    // Fetch car_size from customer_vehicles
    const { data: vehicleData } = await supabase
      .from('customer_vehicles')
      .select('car_size')
      .eq('id', vehicle.id)
      .maybeSingle();
    
    if (vehicleData?.car_size) {
      if (vehicleData.car_size === 'S') setCarSize('small');
      else if (vehicleData.car_size === 'L') setCarSize('large');
      else setCarSize('medium');
    }
    
    if (vehicle.customer_id) {
      const { data } = await supabase
        .from('customers')
        .select('name')
        .eq('id', vehicle.customer_id)
        .maybeSingle();
      
      if (data?.name) {
        setCustomerName(data.name);
        setSelectedCustomerId(vehicle.customer_id);
      }
    }
    
    // Also load all vehicles for this phone
    loadCustomerVehicles(vehicle.phone);
  };

  // Generate time options for start time (every 15 min from 6:00 to 22:00)
  const startTimeOptions = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      startTimeOptions.push(timeStr);
    }
  }

  // Generate time options for end time (every 5 min from 6:00 to 22:00) - allows precise service durations
  const endTimeOptions = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 5) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      endTimeOptions.push(timeStr);
    }
  }

  // Alias for yard deadline (keep 15 min intervals)
  const yardTimeOptions = startTimeOptions;

  // Helper function to save custom car model as proposal
  const saveCarModelProposal = async (carModelValue: string, carSizeValue: CarSize) => {
    try {
      // Parse brand from car model string (first word is usually brand)
      const parts = carModelValue.trim().split(/\s+/);
      const brand = parts[0] || 'Do weryfikacji';
      const name = parts.length > 1 ? parts.slice(1).join(' ') : carModelValue;
      const size = carSizeValue === 'small' ? 'S' : carSizeValue === 'large' ? 'L' : 'M';

      // Insert as proposal - use upsert to avoid duplicates
      await supabase
        .from('car_models')
        .upsert({
          brand,
          name: name || brand,
          size,
          status: 'proposal',
          active: true,
        }, { 
          onConflict: 'brand,name',
          ignoreDuplicates: true 
        });
        
      console.log('Car model proposal saved:', { brand, name, size });
    } catch (error) {
      // Silent failure - don't interrupt user flow
      console.error('Failed to save car model proposal:', error);
    }
  };


  const handleSubmit = async () => {
    // Yard mode validation and submit
    if (isYardMode) {
      if (!carModel.trim()) {
        toast.error(t('addReservation.carModelRequired'));
        return;
      }
      if (selectedServices.length === 0) {
        toast.error(t('addReservation.selectAtLeastOneService'));
        return;
      }
      
      setLoading(true);
      try {
        const vehicleData = {
          instance_id: instanceId,
          customer_name: customerName.trim() || 'Klient',
          customer_phone: phone.trim() || '',
          vehicle_plate: carModel.trim(),
          car_size: carSize || null,
          service_ids: selectedServices,
          arrival_date: format(arrivalDate, 'yyyy-MM-dd'),
          pickup_date: pickupDate ? format(pickupDate, 'yyyy-MM-dd') : null,
          deadline_time: deadlineTime || null,
          notes: adminNotes.trim() || null,
        };

        if (editingYardVehicle) {
          const { error } = await supabase
            .from('yard_vehicles')
            .update(vehicleData)
            .eq('id', editingYardVehicle.id);

          if (error) throw error;
          toast.success(t('addReservation.yardVehicleUpdated'));
        } else {
          const { error } = await supabase
            .from('yard_vehicles')
            .insert({
              ...vehicleData,
              status: 'waiting'
            });

          if (error) throw error;
          toast.success(t('addReservation.yardVehicleAdded'));
        }

        onSuccess();
        onClose();
      } catch (error) {
        console.error('Error saving yard vehicle:', error);
        toast.error(t('addReservation.yardVehicleError'));
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // PPF/Detailing mode validation and submit
    if (isPPFOrDetailingMode) {
      if (!carModel.trim()) {
        toast.error(t('addReservation.carModelRequired'));
        return;
      }
      // Services required only for Detailing mode, optional for PPF
      if (isDetailingMode && selectedServices.length === 0) {
        toast.error(t('addReservation.selectAtLeastOneService'));
        return;
      }
      if (!dateRange?.from) {
        toast.error(t('addReservation.selectDateRange'));
        return;
      }
      if (!propStationId) {
        toast.error(t('addReservation.noStation'));
        return;
      }
      
      setLoading(true);
      try {
        // Create customer if needed
        let customerId = selectedCustomerId;
        
        if (customerName && !customerId && phone) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('instance_id', instanceId)
            .eq('phone', phone)
            .maybeSingle();
          
          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert({
                instance_id: instanceId,
                phone,
                name: customerName,
              })
              .select('id')
              .single();
            
            if (!customerError && newCustomer) {
              customerId = newCustomer.id;
            }
          }
        }

        const reservationData = {
          station_id: propStationId,
          reservation_date: format(dateRange.from, 'yyyy-MM-dd'),
          end_date: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
          start_time: ppfStartTime,
          end_time: ppfEndTime,
          customer_name: customerName.trim() || phone || 'Klient',
          customer_phone: phone || '',
          vehicle_plate: carModel || '',
          car_size: carSize || null,
          admin_notes: adminNotes || null,
          offer_number: offerNumber || null,
          service_id: selectedServices[0] || null,
          service_ids: selectedServices.length > 0 ? selectedServices : null,
        };

        if (isEditMode && editingReservation) {
          const { error: updateError } = await supabase
            .from('reservations')
            .update(reservationData)
            .eq('id', editingReservation.id);

          if (updateError) throw updateError;

          sendPushNotification({
            instanceId,
            title: `✏️ Rezerwacja zmieniona`,
            body: `${customerName.trim() || phone || 'Klient'} - ${formatDateForPush(dateRange.from)} o ${ppfStartTime}`,
            url: `/admin?reservationCode=${editingReservation.confirmation_code || ''}`,
            tag: `edited-reservation-${editingReservation.id}`,
          });

          toast.success(t('addReservation.reservationUpdated'));
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          
          const newReservationData = {
            ...reservationData,
            instance_id: instanceId,
            confirmation_code: Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join(''),
            status: 'confirmed' as const,
            confirmed_at: new Date().toISOString(),
            created_by: user?.id || null,
          };

          const { error: insertError } = await supabase
            .from('reservations')
            .insert([newReservationData]);

          if (insertError) throw insertError;

          sendPushNotification({
            instanceId,
            title: `📅 Nowa rezerwacja (admin)`,
            body: `${customerName.trim() || phone || 'Klient'} - ${formatDateForPush(dateRange.from)} o ${ppfStartTime}`,
            url: `/admin?reservationCode=${newReservationData.confirmation_code}`,
            tag: `new-reservation-admin-${Date.now()}`,
          });

          toast.success(t('addReservation.reservationCreated'));
        }
        
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Error saving reservation:', error);
        toast.error(t('addReservation.reservationError'));
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Reservation mode validation and submit
    if (!carModel.trim()) {
      toast.error(t('addReservation.carModelRequired'));
      return;
    }
    
    if (selectedServices.length === 0) {
      toast.error(t('addReservation.selectAtLeastOneService'));
      return;
    }
    
    // Validate time selection based on mode
    // In edit mode without time change, use original reservation values - skip validation
    if (isEditMode && !isChangingTime && editingReservation) {
      // Use original times - validation passes automatically
    } else if (timeSelectionMode === 'slots') {
      if (!selectedTime || !selectedStationId) {
        toast.error(t('addReservation.selectTimeSlot'));
        return;
      }
    } else {
      // Manual mode
      if (!manualStartTime || !manualEndTime || !manualStationId) {
        toast.error(t('addReservation.selectManualTime'));
        return;
      }
    }

    setLoading(true);
    try {
      // Create customer if needed
      let customerId = selectedCustomerId;
      
      if (customerName && !customerId && phone) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('phone', phone)
          .maybeSingle();
        
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              instance_id: instanceId,
              phone,
              name: customerName,
            })
            .select('id')
            .single();
          
          if (!customerError && newCustomer) {
            customerId = newCustomer.id;
          }
        }
      }

      // Determine start time, end time, and station based on mode
      let finalStartTime: string;
      let finalEndTime: string;
      let finalStationId: string | null;
      
      // Always use manual values in manual mode (they're prefilled with original values on edit)
      if (timeSelectionMode === 'manual') {
        finalStartTime = manualStartTime;
        finalEndTime = manualEndTime;
        finalStationId = manualStationId;
      } else {
        finalStartTime = selectedTime!;
        finalStationId = selectedStationId;
        // Calculate end time from duration
        const [hours, minutes] = finalStartTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + totalDurationMinutes;
        const endHours = Math.floor(totalMinutes / 60);
        const endMins = totalMinutes % 60;
        finalEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
      }

      if (isEditMode && editingReservation) {
        // Update existing reservation
        const updateData = {
          station_id: finalStationId,
          reservation_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: finalStartTime,
          end_time: finalEndTime,
          customer_name: customerName.trim() || phone || 'Klient',
          customer_phone: phone || '',
          vehicle_plate: carModel || '',
          car_size: carSize || null,
          admin_notes: adminNotes.trim() || null,
          price: finalPrice ? parseFloat(finalPrice) : totalPrice,
          service_id: selectedServices[0],
          service_ids: selectedServices,
        };

        const { error: updateError } = await supabase
          .from('reservations')
          .update(updateData)
          .eq('id', editingReservation.id);

        if (updateError) throw updateError;

        // Send push notification for edit
        sendPushNotification({
          instanceId,
          title: `✏️ Rezerwacja zmieniona`,
          body: `${customerName.trim() || phone || 'Klient'} - ${formatDateForPush(selectedDate)} o ${finalStartTime}`,
          url: `/admin?reservationCode=${editingReservation.confirmation_code || ''}`,
          tag: `edited-reservation-${editingReservation.id}`,
        });

        toast.success(t('addReservation.reservationUpdated'));
      } else {
        // Create new reservation
        const { data: { user } } = await supabase.auth.getUser();
        
        const reservationData = {
          instance_id: instanceId,
          station_id: finalStationId,
          reservation_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: finalStartTime,
          end_time: finalEndTime,
          customer_name: customerName.trim() || phone || 'Klient',
          customer_phone: phone || '',
          vehicle_plate: carModel || '',
          car_size: carSize || null,
          admin_notes: adminNotes.trim() || null,
          price: finalPrice ? parseFloat(finalPrice) : totalPrice,
          service_id: selectedServices[0],
          service_ids: selectedServices,
          confirmation_code: Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join(''),
          status: 'confirmed' as const,
          confirmed_at: new Date().toISOString(),
          created_by: user?.id || null,
        };

        const { error: reservationError } = await supabase
          .from('reservations')
          .insert([reservationData]);

        if (reservationError) throw reservationError;

        // Send SMS confirmation if phone is provided
        if (phone) {
          try {
            // Fetch instance data for SMS (prefer short_name)
            const { data: instanceData } = await supabase
              .from('instances')
              .select('name, short_name, google_maps_url, slug')
              .eq('id', instanceId)
              .single();

            if (instanceData) {
              // Check if SMS edit link feature is enabled
              const { data: smsEditLinkFeature } = await supabase
                .from('instance_features')
                .select('enabled, parameters')
                .eq('instance_id', instanceId)
                .eq('feature_key', 'sms_edit_link')
                .maybeSingle();
              
              // Determine if edit link should be included
              let includeEditLink = false;
              if (smsEditLinkFeature?.enabled) {
                const params = smsEditLinkFeature.parameters as { phones?: string[] } | null;
                if (!params || !params.phones || params.phones.length === 0) {
                  includeEditLink = true;
                } else {
                  // Check if phone is in allowed list
                  let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
                  if (!normalizedPhone.startsWith("+")) {
                    normalizedPhone = "+48" + normalizedPhone;
                  }
                  includeEditLink = params.phones.some(p => {
                    let normalizedAllowed = p.replace(/\s+/g, "").replace(/[^\d+]/g, "");
                    if (!normalizedAllowed.startsWith("+")) {
                      normalizedAllowed = "+48" + normalizedAllowed;
                    }
                    return normalizedPhone === normalizedAllowed;
                  });
                }
              }

              // Format date and time for SMS using full month names
              const monthNamesFull = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
              const dateObj = selectedDate;
              const dayNum = dateObj.getDate();
              const monthNameFull = monthNamesFull[dateObj.getMonth()];

              // Use short_name if available, fallback to name
              const instanceName = instanceData.short_name || instanceData.name || 'Myjnia';
              const mapsLink = instanceData.google_maps_url ? ` Dojazd: ${instanceData.google_maps_url}` : '';
              const reservationUrl = `https://${instanceData.slug}.n2wash.com/res?code=${reservationData.confirmation_code}`;
              const editLink = includeEditLink ? ` Zmien lub anuluj: ${reservationUrl}` : '';
              
              const smsMessage = `${instanceName}: Rezerwacja potwierdzona! ${dayNum} ${monthNameFull} o ${finalStartTime}.${mapsLink}${editLink}`;

              await supabase.functions.invoke('send-sms-message', {
                body: {
                  phone: phone,
                  message: smsMessage,
                  instanceId: instanceId
                }
              });
            }
          } catch (smsError) {
            console.error('Error sending SMS confirmation:', smsError);
            // Don't block reservation creation if SMS fails
          }
        }

        // Send push notification for new reservation by admin
        sendPushNotification({
          instanceId,
          title: `📅 Nowa rezerwacja (admin)`,
          body: `${customerName.trim() || 'Klient'} - ${formatDateForPush(selectedDate)} o ${finalStartTime}`,
          url: `/admin?reservationCode=${reservationData.confirmation_code}`,
          tag: `new-reservation-admin-${Date.now()}`,
        });

        toast.success(t('addReservation.reservationCreated'));
        
        // Save custom car model as proposal (silently in background)
        if (isCustomCarModel && carModel.trim() && carModel.trim() !== 'BRAK') {
          saveCarModelProposal(carModel.trim(), carSize);
        }
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving reservation:', error);
      toast.error(t('addReservation.reservationError'));
    } finally {
      setLoading(false);
    }
  };

  // Get selected service names for display
  const selectedServiceNames = services
    .filter(s => selectedServices.includes(s.id))
    .map(s => s.shortcut || s.name);

  const canGoPrev = !isBefore(subDays(selectedDate, 1), startOfDay(new Date()));

  const [notesOpen, setNotesOpen] = useState(false);

  // Get dialog title based on mode
  const getDialogTitle = () => {
    if (isYardMode) {
      return isEditMode ? t('addReservation.yardEditTitle') : t('addReservation.yardTitle');
    }
    if (isPPFOrDetailingMode) {
      return isEditMode ? t('reservations.editReservation') : t('addReservation.title');
    }
    return isEditMode ? t('reservations.editReservation') : t('addReservation.title');
  };

  // Get station type label for service filtering
  const getStationTypeLabel = () => {
    if (mode === 'ppf') return 'PPF';
    if (mode === 'detailing') return 'Detailing';
    return '';
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={false}>
        <SheetContent 
          side="right"
          className={cn(
            "w-full sm:max-w-[27rem] flex flex-col h-full p-0 gap-0 shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]",
            isMobile && isDrawerHidden && "!hidden"
          )}
          hideOverlay
          hideCloseButton
          // Keep drawer open; allow clicking calendar behind
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
        {/* Fixed Header with Close button */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>
              {getDialogTitle()}
              {isPPFOrDetailingMode && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({getStationTypeLabel()})
                </span>
              )}
            </SheetTitle>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Customer Name - using new ClientSearchAutocomplete */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t('addReservation.customerNameAlias')} <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
              </Label>
              <ClientSearchAutocomplete
                instanceId={instanceId}
                value={customerName}
                onChange={(val) => {
                  setCustomerName(val);
                  setSelectedCustomerId(null);
                }}
                onSelect={async (customer) => {
                  setCustomerName(customer.name);
                  setPhone(customer.phone);
                  setSelectedCustomerId(customer.id);
                  
                  // Fetch customer's most recent vehicle - try by customer_id first, then by phone
                  let vehicleData = null;
                  
                  // Try by customer_id
                  const { data: byCustomerId } = await supabase
                    .from('customer_vehicles')
                    .select('model, car_size')
                    .eq('instance_id', instanceId)
                    .eq('customer_id', customer.id)
                    .order('last_used_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (byCustomerId) {
                    vehicleData = byCustomerId;
                  } else {
                    // Fallback: try by phone number (normalized - remove spaces and country code)
                    const normalizedPhone = normalizePhone(customer.phone);
                    const { data: byPhone } = await supabase
                      .from('customer_vehicles')
                      .select('model, car_size')
                      .eq('instance_id', instanceId)
                      .or(`phone.ilike.%${normalizedPhone}%`)
                      .order('last_used_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    
                    if (byPhone) {
                      vehicleData = byPhone;
                    }
                  }
                  
                  if (vehicleData) {
                    setCarModel(vehicleData.model);
                    if (vehicleData.car_size === 'S') setCarSize('small');
                    else if (vehicleData.car_size === 'L') setCarSize('large');
                    else setCarSize('medium');
                  }
                }}
                onClear={() => {
                  setSelectedCustomerId(null);
                }}
                suppressAutoSearch={isEditMode}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="phone">
                  {t('common.phone')}
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              setPhone(text.trim());
                              setSelectedCustomerId(null);
                            }
                          } catch (err) {
                            console.error('Failed to read clipboard:', err);
                          }
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors group"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{t('common.paste')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="relative">
                <PhoneMaskedInput
                  id="phone"
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    setSelectedCustomerId(null);
                  }}
                  autoComplete="off"
                />
                {searchingCustomer && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {showPhoneDropdown && foundVehicles.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]">
                  {foundVehicles.map((vehicle) => {
                    // Format phone: remove +48 prefix, add spaces for 9-digit numbers
                    const formatDisplayPhone = (phone: string) => {
                      let display = phone.replace(/^\+48\s*/, '');
                      const digits = display.replace(/\D/g, '');
                      if (digits.length === 9) {
                        return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
                      }
                      return display;
                    };
                    
                    return (
                      <button
                        key={vehicle.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-muted/30 transition-colors flex flex-col border-b border-border last:border-0"
                        onClick={() => selectVehicle(vehicle)}
                      >
                        <div className="font-medium text-base">
                          {vehicle.customer_name || formatDisplayPhone(vehicle.phone)}
                        </div>
                        <div className="text-sm">
                          <span className="text-primary">{formatDisplayPhone(vehicle.phone)}</span>
                          {vehicle.model && <span className="text-muted-foreground"> • {vehicle.model}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Car Model + Size - REQUIRED */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {t('reservations.carModel')} <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <CarSearchAutocomplete
                    value={carModel}
                    onChange={(val: CarSearchValue) => {
                      if (val === null) {
                        setCarModel('');
                        setIsCustomCarModel(false);
                        setSelectedVehicleId(null);
                      } else if ('type' in val && val.type === 'custom') {
                        setCarModel(val.label);
                        setIsCustomCarModel(true);
                        setSelectedVehicleId(null);
                      } else {
                        setCarModel(val.label);
                        setIsCustomCarModel(false);
                        setSelectedVehicleId(null);
                        if ('size' in val) {
                          if (val.size === 'S') setCarSize('small');
                          else if (val.size === 'M') setCarSize('medium');
                          else if (val.size === 'L') setCarSize('large');
                        }
                      }
                    }}
                    suppressAutoOpen={isEditMode}
                  />
                </div>
                
                <TooltipProvider>
                  <div className="flex gap-1 shrink-0">
                    {(['small', 'medium', 'large'] as CarSize[]).map((size) => (
                      <Tooltip key={size}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant={carSize === size ? 'default' : 'outline'}
                            className="w-9 h-9 font-bold p-0"
                            onClick={() => setCarSize(size)}
                          >
                            {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{t(`reservations.carSizes.${size}`)}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
              
              {/* Customer vehicles pills */}
              {customerVehicles.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {customerVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => {
                        setSelectedVehicleId(vehicle.id);
                        setCarModel(vehicle.model);
                        if (vehicle.car_size === 'S') setCarSize('small');
                        else if (vehicle.car_size === 'L') setCarSize('large');
                        else setCarSize('medium');
                      }}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-full transition-colors font-medium",
                        selectedVehicleId === vehicle.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-white hover:bg-muted/50 text-foreground border border-border"
                      )}
                    >
                      {vehicle.model}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Services selection - shortcuts + drawer (NOT for PPF mode, only for Detailing/Reservation/Yard) */}
            {!isPPFMode && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">{t('addReservation.selectServiceFirst')}</Label>
                
                {/* Popular service shortcuts - only show unselected ones */}
                {services.filter(s => s.is_popular && !selectedServices.includes(s.id)).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {services
                      .filter(s => s.is_popular && !selectedServices.includes(s.id))
                      .map(service => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            setSelectedServices(prev => [...prev, service.id]);
                            if (isReservationMode) {
                              setSelectedTime(null);
                              setSelectedStationId(null);
                            }
                          }}
                          className="px-3 py-1.5 text-sm rounded-full transition-colors font-medium bg-slate-50 hover:bg-slate-100 text-foreground border border-slate-200"
                        >
                          {service.shortcut || service.name}
                        </button>
                      ))}
                  </div>
                )}
                
                {/* Selected services with X to remove */}
                <div 
                  className={cn(
                    "rounded-lg border-2 border-dashed p-3 transition-colors",
                    selectedServices.length > 0
                      ? "border-primary/50 bg-primary/5"
                      : "border-muted-foreground/30"
                  )}
                >
                  {selectedServices.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {selectedServiceNames.map((name, i) => (
                          <span 
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full bg-primary/10 text-primary"
                          >
                            {name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const serviceToRemove = services.find(s => (s.shortcut || s.name) === name);
                                if (serviceToRemove) {
                                  setSelectedServices(prev => prev.filter(id => id !== serviceToRemove.id));
                                  if (isReservationMode) {
                                    setSelectedTime(null);
                                    setSelectedStationId(null);
                                  }
                                }
                              }}
                              className="hover:bg-primary/20 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {/* Add button to open drawer */}
                        <button
                          type="button"
                          onClick={() => setServiceDrawerOpen(true)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <Plus className="w-3 h-3" />
                          {t('common.add')}
                        </button>
                      </div>
                      {(isReservationMode || isYardMode) && selectedServices.length > 0 && (
                        <p className="text-base font-bold mt-1">
                          {t('addReservation.totalDuration')}: {totalDurationMinutes >= 60 
                            ? `${Math.floor(totalDurationMinutes / 60)}h${totalDurationMinutes % 60 > 0 ? ` ${totalDurationMinutes % 60}min` : ''}`
                            : `${totalDurationMinutes}min`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setServiceDrawerOpen(true)}
                      className="w-full text-left text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t('addReservation.selectServices')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Service Selection Drawer */}
            {!isPPFMode && (
              <ServiceSelectionDrawer
                open={serviceDrawerOpen}
                onClose={() => setServiceDrawerOpen(false)}
                instanceId={instanceId}
                carSize={carSize}
                selectedServiceIds={selectedServices}
                stationType={getStationType()}
                onConfirm={(serviceIds, duration) => {
                  setSelectedServices(serviceIds);
                  // Reset time selection when services change (reservation mode only)
                  if (isReservationMode) {
                    setSelectedTime(null);
                    setSelectedStationId(null);
                  }
                }}
              />
            )}

            {/* Divider between services and time/date selection */}
            <Separator className="my-2" />

            {/* YARD MODE - Arrival Date, Pickup Date, Deadline */}
            {isYardMode && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {t('addReservation.arrivalDate')}
                    </Label>
                    <Popover open={arrivalDateOpen} onOpenChange={setArrivalDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !arrivalDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {arrivalDate ? format(arrivalDate, 'd MMM', { locale: pl }) : t('addReservation.selectDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={arrivalDate}
                          onSelect={(date) => {
                            if (date) {
                              setArrivalDate(date);
                              setArrivalDateOpen(false);
                            }
                          }}
                          locale={pl}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {t('addReservation.pickupDate')}
                    </Label>
                    <Popover open={pickupDateOpen} onOpenChange={setPickupDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !pickupDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {pickupDate ? format(pickupDate, 'd MMM', { locale: pl }) : t('addReservation.selectDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={pickupDate || undefined}
                          onSelect={(date) => {
                            setPickupDate(date || null);
                            setPickupDateOpen(false);
                          }}
                          locale={pl}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t('addReservation.deadline')}
                  </Label>
                  <Select value={deadlineTime} onValueChange={setDeadlineTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="--:--" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      <SelectItem value="none">{t('common.noResults')}</SelectItem>
                      {yardTimeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* PPF/DETAILING MODE - Date Range, Start/End Time, Offer Number */}
            {isPPFOrDetailingMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {t('addReservation.dateRangePpf')}
                  </Label>
                  <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "d MMM", { locale: pl })} -{" "}
                              {format(dateRange.to, "d MMM yyyy", { locale: pl })}
                            </>
                          ) : (
                            format(dateRange.from, "d MMM yyyy", { locale: pl })
                          )
                        ) : (
                          <span>{t('addReservation.selectDateRange')}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        defaultMonth={dateRange?.from || new Date()}
                        selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range);
                          if (range?.from && range?.to) {
                            setDateRangeOpen(false);
                          }
                        }}
                        numberOfMonths={2}
                        locale={pl}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ppfStartTime">
                      {t('addReservation.startTime')}
                    </Label>
                    <Input
                      id="ppfStartTime"
                      type="time"
                      value={ppfStartTime}
                      onChange={(e) => setPpfStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ppfEndTime">
                      {t('addReservation.endTime')}
                    </Label>
                    <Input
                      id="ppfEndTime"
                      type="time"
                      value={ppfEndTime}
                      onChange={(e) => setPpfEndTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="offerNumber">
                    {t('addReservation.offerNumber')} <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
                  </Label>
                  <Input
                    id="offerNumber"
                    value={offerNumber}
                    onChange={(e) => setOfferNumber(e.target.value)}
                    placeholder={t('addReservation.offerNumberPlaceholder')}
                  />
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {t('addReservation.multiDayHint')}
                </p>
              </div>
            )}

            {/* RESERVATION MODE - Date navigation + Time slots */}
            {isReservationMode && (
              <>
                {/* Edit mode: show summary or full editor */}
                {isEditMode && !isChangingTime ? (
                  // Summary view with "Zmień termin" button
                  <div className="space-y-2">
                    <p className="text-lg font-medium">
                      {format(selectedDate, 'EEEE, d MMMM', { locale: pl })}, {timeSelectionMode === 'manual' 
                        ? `${manualStartTime || editingReservation?.start_time?.substring(0, 5) || '--:--'} - ${manualEndTime || editingReservation?.end_time?.substring(0, 5) || '--:--'}`
                        : selectedTime 
                          ? `${selectedTime} - ${(() => {
                              const [h, m] = selectedTime.split(':').map(Number);
                              const endMinutes = h * 60 + m + totalDurationMinutes;
                              return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
                            })()}`
                          : `${editingReservation?.start_time?.substring(0, 5) || '--:--'} - ${editingReservation?.end_time?.substring(0, 5) || '--:--'}`
                      }
                    </p>
                    <Button
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        // Save original values before changing
                        setOriginalDate(selectedDate);
                        setOriginalTime(selectedTime);
                        setOriginalStationId(selectedStationId);
                        setOriginalManualStartTime(manualStartTime);
                        setOriginalManualEndTime(manualEndTime);
                        setOriginalManualStationId(manualStationId);
                        setOriginalTimeSelectionMode(timeSelectionMode);
                        setIsChangingTime(true);
                      }}
                    >
                      {t('addReservation.changeTerm')}
                    </Button>
                  </div>
                ) : (
                  // Full date/time selection (new reservation or changing time)
                  <>
                    {/* Date navigation with chevron */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={handlePrevDay}
                          disabled={!canGoPrev}
                          className={cn(
                            "p-2 rounded-full transition-colors",
                            canGoPrev ? "hover:bg-muted text-foreground" : "opacity-30 cursor-not-allowed"
                          )}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        
                        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-1 text-base font-medium hover:text-primary transition-colors"
                            >
                              {format(selectedDate, 'EEEE, d MMM', { locale: pl })}
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                if (date) {
                                  setSelectedDate(date);
                                  setSelectedTime(null);
                                  setDatePickerOpen(false);
                                }
                              }}
                              disabled={(date) => {
                                // Disable past dates
                                if (isBefore(date, startOfDay(new Date()))) return true;
                                // Disable closed days based on working hours
                                if (workingHours) {
                                  const dayName = format(date, 'EEEE').toLowerCase();
                                  const dayHours = workingHours[dayName];
                                  if (!dayHours || !dayHours.open || !dayHours.close) return true;
                                }
                                return false;
                              }}
                              locale={pl}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        
                        <button
                          type="button"
                          onClick={handleNextDay}
                          className="p-2 rounded-full hover:bg-muted text-foreground transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Time selection with tabs */}
                    <div className="space-y-2">
                      <Tabs 
                        value={timeSelectionMode} 
                        onValueChange={(v) => {
                          setTimeSelectionMode(v as 'slots' | 'manual');
                          // Reset or prefill values when switching tabs
                          if (v === 'slots') {
                            setManualStartTime('');
                            setManualEndTime('');
                            setManualStationId(null);
                          } else {
                            // When switching to manual mode, prefill with current reservation data
                            if (isEditMode && editingReservation) {
                              setManualStartTime(editingReservation.start_time?.substring(0, 5) || '');
                              setManualEndTime(editingReservation.end_time?.substring(0, 5) || '');
                              setManualStationId(editingReservation.station_id);
                            } else {
                              setSelectedTime(null);
                              setSelectedStationId(null);
                            }
                          }
                        }}
                      >
                        {/* Tabs hidden on desktop, visible on mobile */}
                        <TabsList variant="light" className="w-full sm:hidden">
                          <TabsTrigger value="slots" className="flex-1">
                            {t('addReservation.availableSlotsTab')}
                          </TabsTrigger>
                          <TabsTrigger value="manual" className="flex-1">
                            {t('addReservation.manualTimeTab')}
                          </TabsTrigger>
                        </TabsList>
                        
                        {/* Available slots tab - hidden on desktop */}
                        <TabsContent value="slots" className="mt-3 sm:hidden">
                          {selectedServices.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              {t('addReservation.selectServiceFirst')}
                            </p>
                          ) : availableSlots.length > 0 ? (
                            <div className="w-full overflow-hidden">
                              <div 
                                ref={slotsScrollRef}
                                className="flex gap-3 overflow-x-auto pb-2 w-full touch-pan-x"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                              >
                                {availableSlots.map((slot) => {
                                  const isSelected = selectedTime === slot.time;
                                  const isOverlapSingle = slot.overlapType === 'single';
                                  const isOverlapDouble = slot.overlapType === 'double';
                                  
                                  return (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      onClick={() => handleSelectSlot(slot)}
                                      className={cn(
                                        "flex-shrink-0 py-3 px-5 rounded-2xl text-base font-medium transition-all duration-200 min-w-[80px] flex items-center justify-center gap-1.5",
                                        isSelected 
                                          ? "bg-primary text-primary-foreground shadow-lg" 
                                          : isOverlapDouble
                                            ? "bg-red-50 border-2 border-red-300 text-red-700 hover:border-red-400"
                                            : isOverlapSingle
                                              ? "bg-orange-50 border-2 border-orange-300 text-orange-700 hover:border-orange-400"
                                              : "bg-card border-2 border-border hover:border-primary/50"
                                      )}
                                    >
                                      {(isOverlapSingle || isOverlapDouble) && !isSelected && (
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                      )}
                                      {slot.time}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              {t('booking.noSlotsForDay')}
                            </p>
                          )}
                        </TabsContent>
                        
                        {/* Manual time tab - always visible content on desktop */}
                        <TabsContent value="manual" className="mt-3 space-y-4 sm:block" forceMount>
                          {/* Time selectors - hidden on mobile when slots tab is active */}
                          <div className={cn(
                            "grid grid-cols-2 gap-4",
                            timeSelectionMode === 'slots' && "hidden sm:grid"
                          )}>
                            <div className="space-y-2">
                              <Label htmlFor="manualStartTime">{t('addReservation.manualStartTime')}</Label>
                              <Select value={manualStartTime} onValueChange={setManualStartTime}>
                                <SelectTrigger id="manualStartTime">
                                  <SelectValue placeholder="--:--" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover max-h-60">
                                  {startTimeOptions.map((time) => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="manualEndTime">{t('addReservation.manualEndTime')}</Label>
                              <Select value={manualEndTime} onValueChange={setManualEndTime}>
                                <SelectTrigger id="manualEndTime">
                                  <SelectValue placeholder="--:--" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover max-h-60">
                                  {endTimeOptions.map((time) => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {/* Station selector - hidden on desktop, also hidden on mobile when slots tab is active */}
                          <div className={cn(
                            "space-y-2",
                            timeSelectionMode === 'slots' ? "hidden" : "sm:hidden"
                          )}>
                            <Label htmlFor="manualStation">{t('addReservation.selectStation')}</Label>
                            <Select value={manualStationId || ''} onValueChange={setManualStationId}>
                              <SelectTrigger>
                                <SelectValue placeholder={t('addReservation.selectStation')} />
                              </SelectTrigger>
                              <SelectContent>
                                {stations.map((station) => (
                                  <SelectItem key={station.id} value={station.id}>
                                    {station.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>

                    {/* Move/Cancel buttons for edit mode time change */}
                    {isEditMode && isChangingTime && (
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="button"
                          onClick={() => {
                            setIsChangingTime(false);
                          }}
                          disabled={
                            (timeSelectionMode === 'slots' && !selectedTime) ||
                            (timeSelectionMode === 'manual' && (!manualStartTime || !manualEndTime || !manualStationId))
                          }
                          className="flex-1"
                        >
                          {t('addReservation.moveReservation')}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            // Restore original values
                            if (originalDate) setSelectedDate(originalDate);
                            setSelectedTime(originalTime);
                            setSelectedStationId(originalStationId);
                            setManualStartTime(originalManualStartTime);
                            setManualEndTime(originalManualEndTime);
                            setManualStationId(originalManualStationId);
                            setTimeSelectionMode(originalTimeSelectionMode);
                            setIsChangingTime(false);
                          }}
                          className="flex-1"
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Notes - always visible */}
            <div className="space-y-2">
              <Label htmlFor="adminNotes" className="text-sm text-muted-foreground">
                {t('addReservation.notes')}
              </Label>
              <Textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder={t('addReservation.notesPlaceholder')}
              />
            </div>

            {/* Final Price - always visible in reservation mode */}
            {isReservationMode && (
              <div className="space-y-2">
                <Label htmlFor="finalPrice" className="text-sm text-muted-foreground">
                  {t('addReservation.amount')}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="finalPrice"
                    type="number"
                    value={finalPrice}
                    onChange={(e) => setFinalPrice(e.target.value)}
                    placeholder={`${totalPrice}`}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">zł</span>
                  {customerDiscountPercent && customerDiscountPercent > 0 && (
                    <span className="text-sm text-green-600">
                      -{customerDiscountPercent}% rabat
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <SheetFooter className="px-6 py-4 border-t shrink-0">
          <Button 
            onClick={handleSubmit} 
            disabled={
              loading || 
              !carModel.trim() ||
              // Disable save button when actively changing time in edit mode
              (isEditMode && isReservationMode && isChangingTime) ||
              (isReservationMode && !isEditMode && (
                selectedServices.length === 0 || 
                (timeSelectionMode === 'slots' && !selectedTime) ||
                (timeSelectionMode === 'manual' && (!manualStartTime || !manualEndTime || !manualStationId))
              )) ||
              (isReservationMode && isEditMode && !isChangingTime && selectedServices.length === 0) ||
              (isYardMode && selectedServices.length === 0) ||
              (isDetailingMode && selectedServices.length === 0) ||
              (isPPFOrDetailingMode && !dateRange?.from)
            } 
            className="w-full"
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isYardMode 
              ? (isEditMode ? t('common.save') : t('addReservation.addVehicle'))
              : (isEditMode ? t('common.save') : t('addReservation.addReservation'))
            }
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    
    {/* Mobile FAB: Toggle drawer visibility to peek at calendar */}
    {isMobile && open && (
      <button
        type="button"
        onClick={() => setIsDrawerHidden(prev => !prev)}
        className="fixed bottom-24 right-4 z-[60] w-11 h-11 rounded-full bg-success text-success-foreground shadow-lg flex items-center justify-center text-lg font-bold hover:bg-success/90 transition-colors"
      >
        {isDrawerHidden ? 'R' : 'K'}
      </button>
    )}
    </>
  );
};

export default AddReservationDialogV2;
