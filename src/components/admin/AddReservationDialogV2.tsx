import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, ChevronDown, X, CalendarIcon, Clock, Plus, ClipboardPaste } from 'lucide-react';
import { format, addDays, isSameDay, isBefore, startOfDay } from 'date-fns';
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
import { normalizePhone as normalizePhoneForStorage } from '@/lib/phoneUtils';
import ServiceSelectionDrawer, { ServiceWithCategory } from './ServiceSelectionDrawer';
import SelectedServicesList, { ServiceItem } from './SelectedServicesList';
import { OfferSearchAutocomplete } from '@/components/protocols/OfferSearchAutocomplete';

type CarSize = 'small' | 'medium' | 'large';
type DialogMode = 'reservation' | 'yard';

interface Service {
  id: string;
  name: string;
  short_name?: string | null;
  category_id?: string | null;
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

interface WorkingHours {
  open: string;
  close: string;
}

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
  service_items?: ServiceItem[] | null;
  customer_notes?: string | null;
  admin_notes?: string | null;
  price?: number | null;
  confirmation_code?: string;
  offer_number?: string | null;
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
  onSuccess: (reservationId?: string) => void;
  workingHours?: Record<string, WorkingHours | null> | null;
  /** Optional reservation to edit - when provided, dialog works in edit mode */
  editingReservation?: EditingReservation | null;
  /** Mode: reservation or yard */
  mode?: DialogMode;
  /** Station ID for reservation mode */
  stationId?: string;
  /** Yard vehicle to edit when mode='yard' */
  editingYardVehicle?: YardVehicle | null;
  /** Initial date from slot click */
  initialDate?: string;
  /** Initial time from slot click */
  initialTime?: string;
  /** Initial station from slot click */
  initialStationId?: string;
  /** Callback for live slot preview on calendar */
  onSlotPreviewChange?: (preview: {
    date: string;
    startTime: string;
    endTime: string;
    stationId: string;
  } | null) => void;
  /** Current user's username to save with new reservations */
  currentUsername?: string | null;
}

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
  currentUsername = null,
}: AddReservationDialogV2Props) => {
  const isYardMode = mode === 'yard';
  const isReservationMode = mode === 'reservation';
  const isEditMode = isYardMode ? !!editingYardVehicle : !!editingReservation;
  
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  // Mobile: toggle drawer visibility to peek at calendar
  const [isDrawerHidden, setIsDrawerHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  
  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<{
    phone?: string;
    carModel?: string;
    services?: string;
    time?: string;
    dateRange?: string;
  }>({});
  
  // Refs for scroll-to-error
  const phoneInputRef = useRef<HTMLDivElement>(null);
  const carModelRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const dateRangeRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
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
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [servicesWithCategory, setServicesWithCategory] = useState<ServiceWithCategory[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCustomCarModel, setIsCustomCarModel] = useState(false);
  const [customerDiscountPercent, setCustomerDiscountPercent] = useState<number | null>(null);
  
  // Customer vehicles pills state
  const [customerVehicles, setCustomerVehicles] = useState<CustomerVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Services dropdown
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);

  // Manual time selection
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualStationId, setManualStationId] = useState<string | null>(null);
  
  // Track the last totalDurationMinutes to detect changes
  const prevTotalDurationRef = useRef<number>(0);

  // Protection against Realtime overwriting form during active editing
  const isUserEditingRef = useRef(false);
  const lastEditingReservationIdRef = useRef<string | null>(null);
  
  // Flag to prevent auto-calculation from overwriting manual end time
  const [userModifiedEndTime, setUserModifiedEndTime] = useState(false);
  
  // Track original duration for edit mode - to adjust end time when start time changes
  const originalDurationMinutesRef = useRef<number | null>(null);
  // Track previous manual start time to detect user-initiated changes
  const prevManualStartTimeRef = useRef<string>('');

  // Helper to mark form as being actively edited by user
  const markUserEditing = useCallback(() => {
    isUserEditingRef.current = true;
  }, []);

  // Yard mode state
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date());
  const [arrivalDateOpen, setArrivalDateOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [pickupDateOpen, setPickupDateOpen] = useState(false);
  const [deadlineTime, setDeadlineTime] = useState('');

  // Reservation mode - DateRange picker (default 1 day)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [offerNumber, setOfferNumber] = useState('');

  // Fetch services and stations on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;
      
      // Fetch all active services (no station_type filtering)
      const servicesQuery = supabase
        .from('unified_services')
        .select('id, name, short_name, category_id, duration_minutes, duration_small, duration_medium, duration_large, price_from, price_small, price_medium, price_large, station_type, is_popular')
        .eq('instance_id', instanceId)
        .eq('service_type', 'reservation')
        .eq('active', true);
      
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
  }, [open, instanceId, mode, isReservationMode]);

  // Calculate the next working day based on working hours
  const getNextWorkingDay = useCallback((): Date => {
    if (!workingHours) return new Date();
    
    const now = new Date();
    let checkDate = startOfDay(now);
    
    // Check if today is still a valid working day
    const todayName = format(now, 'EEEE').toLowerCase();
    const todayHours = workingHours[todayName];
    
    if (todayHours?.close && todayHours.close.includes(':')) {
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
      // PROTECTION: Skip re-initialization if user is actively editing the same reservation
      if (isUserEditingRef.current && editingReservation?.id === lastEditingReservationIdRef.current) {
        console.log('[ReservationDialog] Skipping re-init - user is actively editing');
        return;
      }
      
      // Track which reservation we're editing
      lastEditingReservationIdRef.current = editingReservation?.id || null;
      
      // Reset user editing flags for new dialog session
      setUserModifiedEndTime(false);
      setValidationErrors({});
      
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
        setCustomerDiscountPercent(null);
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
        setCustomerDiscountPercent(null);
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
        
        // Load servicesWithCategory from services list for backwards compatibility
        if (services.length > 0 && serviceIds.length > 0) {
          const loadedServicesWithCategory: ServiceWithCategory[] = [];
          serviceIds.forEach(id => {
            const service = services.find(s => s.id === id);
            if (service) {
              loadedServicesWithCategory.push({
                id: service.id,
                name: service.name,
                short_name: service.short_name,
                category_id: service.category_id,
                duration_minutes: service.duration_minutes,
                duration_small: service.duration_small,
                duration_medium: service.duration_medium,
                duration_large: service.duration_large,
                price_from: service.price_from,
                price_small: service.price_small,
                price_medium: service.price_medium,
                price_large: service.price_large,
                category_prices_are_net: false,
              });
            }
          });
          setServicesWithCategory(loadedServicesWithCategory);
        }
        
        // Load serviceItems from reservation's service_items column if available
        const reservationServiceItems = editingReservation.service_items as ServiceItem[] | null;
        if (reservationServiceItems && Array.isArray(reservationServiceItems) && reservationServiceItems.length > 0) {
          setServiceItems(reservationServiceItems);
        } else {
          // Initialize serviceItems for legacy reservations without service_items
          setServiceItems(serviceIds.map(id => ({ service_id: id, custom_price: null })));
        }
        
        // Date range - use reservation_date and end_date
        const fromDate = new Date(editingReservation.reservation_date);
        const toDate = editingReservation.end_date ? new Date(editingReservation.end_date) : fromDate;
        setDateRange({ from: fromDate, to: toDate });
        
        setAdminNotes(editingReservation.admin_notes || '');
        setFinalPrice(editingReservation.price?.toString() || '');
        setOfferNumber(editingReservation.offer_number || '');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setCustomerDiscountPercent(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
        
        // Set manual time from editing reservation
        const startTimeStr = editingReservation.start_time?.substring(0, 5) || '';
        const endTimeStr = editingReservation.end_time?.substring(0, 5) || '';
        setManualStartTime(startTimeStr);
        setManualEndTime(endTimeStr);
        setManualStationId(editingReservation.station_id);
        
        // Calculate and store original duration for automatic end time adjustment
        if (startTimeStr && endTimeStr && startTimeStr.includes(':') && endTimeStr.includes(':')) {
          const [startH, startM] = startTimeStr.split(':').map(Number);
          const [endH, endM] = endTimeStr.split(':').map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          originalDurationMinutesRef.current = endMinutes - startMinutes;
          prevManualStartTimeRef.current = startTimeStr;
        }
        
        // CRITICAL: Mark end time as user-modified to prevent useEffect from recalculating it
        setUserModifiedEndTime(true);
      } else if (initialDate && initialTime && initialStationId && !editingReservation) {
        // Slot click
        if (wasOpenRef.current) {
          // Dialog was already open - only update date/time/station, keep other data
          const slotDate = new Date(initialDate);
          setDateRange({ from: slotDate, to: slotDate });
          setManualStartTime(initialTime);
          setManualStationId(initialStationId);
          // Recalculate end time based on current services duration
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
          const slotDate = new Date(initialDate);
          setDateRange({ from: slotDate, to: slotDate });
          setAdminNotes('');
          setFinalPrice('');
          setOfferNumber('');
          setFoundCustomers([]);
          setSelectedCustomerId(null);
          setCustomerDiscountPercent(null);
          setShowPhoneDropdown(false);
          setShowCustomerDropdown(false);
          setCustomerVehicles([]);
          setSelectedVehicleId(null);
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
        // Default to today with 1-day range
        const today = getNextWorkingDay();
        setDateRange({ from: today, to: today });
        setAdminNotes('');
        setFinalPrice('');
        setOfferNumber('');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setCustomerDiscountPercent(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);
        setManualStartTime('');
        setManualEndTime('');
        setManualStationId(null);
      }
      // Track that dialog is now open
      wasOpenRef.current = true;
    } else {
      // Dialog closed - reset tracking refs
      wasOpenRef.current = false;
      isUserEditingRef.current = false;
      lastEditingReservationIdRef.current = null;
      originalDurationMinutesRef.current = null;
      prevManualStartTimeRef.current = '';
      setServicesWithCategory([]); // Reset services list for next open
    }
  }, [open, getNextWorkingDay, editingReservation, isYardMode, editingYardVehicle, initialDate, initialTime, initialStationId, services, selectedServices, carSize]);

  // NEW: Re-map servicesWithCategory when services are loaded (for edit mode)
  useEffect(() => {
    if (!open || services.length === 0) return;
    
    // Skip if servicesWithCategory is already populated (user already editing)
    if (servicesWithCategory.length > 0) return;
    
    // Handle reservation edit mode
    if (editingReservation) {
      const serviceIds = (editingReservation.service_ids && editingReservation.service_ids.length > 0) 
        ? editingReservation.service_ids 
        : (editingReservation.service_id ? [editingReservation.service_id] : []);
      
      if (serviceIds.length === 0) return;
      
      const loadedServicesWithCategory: ServiceWithCategory[] = [];
      serviceIds.forEach(id => {
        const service = services.find(s => s.id === id);
        if (service) {
          loadedServicesWithCategory.push({
            id: service.id,
            name: service.name,
            short_name: service.short_name,
            category_id: service.category_id,
            duration_minutes: service.duration_minutes,
            duration_small: service.duration_small,
            duration_medium: service.duration_medium,
            duration_large: service.duration_large,
            price_from: service.price_from,
            price_small: service.price_small,
            price_medium: service.price_medium,
            price_large: service.price_large,
            category_prices_are_net: false,
          });
        }
      });
      
      if (loadedServicesWithCategory.length > 0) {
        setServicesWithCategory(loadedServicesWithCategory);
        // Also initialize serviceItems from editingReservation if available
        if (editingReservation.service_items && editingReservation.service_items.length > 0) {
          setServiceItems(editingReservation.service_items);
        }
      }
    }
  }, [open, services, editingReservation, servicesWithCategory.length]);

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

  // Calculate total price from selected services (using custom prices from serviceItems if available)
  const totalPrice = selectedServices.reduce((total, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return total;
    
    // Check if there's a custom price in serviceItems
    const serviceItem = serviceItems.find(si => si.service_id === serviceId);
    if (serviceItem?.custom_price !== null && serviceItem?.custom_price !== undefined) {
      return total + serviceItem.custom_price;
    }
    
    return total + getServicePrice(service);
  }, 0);

  // Calculate discounted price
  const discountedPrice = customerDiscountPercent && customerDiscountPercent > 0 
    ? Math.round(totalPrice * (1 - customerDiscountPercent / 100))
    : totalPrice;

  // Auto-update end time when start time or duration changes (for reservation mode)
  useEffect(() => {
    if (!isReservationMode || !open) return;
    
    // Skip if user manually modified end time
    if (userModifiedEndTime) return;
    
    // Skip if no start time
    if (!manualStartTime || !manualStartTime.includes(':')) return;
    
    // Calculate new end time based on total duration
    if (totalDurationMinutes > 0) {
      const [h, m] = manualStartTime.split(':').map(Number);
      const endMinutes = h * 60 + m + totalDurationMinutes;
      const newEndTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
      setManualEndTime(newEndTime);
    }
    
    prevTotalDurationRef.current = totalDurationMinutes;
  }, [open, isReservationMode, manualStartTime, totalDurationMinutes, userModifiedEndTime]);

  // Auto-adjust end time when start time changes in edit mode (preserve duration)
  useEffect(() => {
    if (!isReservationMode || !open || !isEditMode) return;
    
    // Skip if user manually modified end time
    if (userModifiedEndTime) return;
    
    // Skip if no original duration stored
    if (originalDurationMinutesRef.current === null) return;
    
    // Skip if start time hasn't actually changed
    if (manualStartTime === prevManualStartTimeRef.current) return;
    
    // Skip if start time is empty or invalid
    if (!manualStartTime || !manualStartTime.includes(':')) return;
    
    // Calculate new end time preserving original duration
    const [h, m] = manualStartTime.split(':').map(Number);
    const endMinutes = h * 60 + m + originalDurationMinutesRef.current;
    const newEndTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
    setManualEndTime(newEndTime);
    
    prevManualStartTimeRef.current = manualStartTime;
  }, [open, isReservationMode, isEditMode, manualStartTime, userModifiedEndTime]);

  // Emit slot preview for calendar highlighting (reservation mode only)
  useEffect(() => {
    if (!open || !isReservationMode || !onSlotPreviewChange) return;
    
    // In edit mode, always show preview based on current manual values
    if (manualStartTime && manualEndTime && manualStationId && dateRange?.from) {
      onSlotPreviewChange({
        date: format(dateRange.from, 'yyyy-MM-dd'),
        startTime: manualStartTime,
        endTime: manualEndTime,
        stationId: manualStationId,
      });
    } else {
      onSlotPreviewChange(null);
    }
  }, [
    open,
    isReservationMode,
    isEditMode,
    dateRange,
    manualStartTime,
    manualEndTime,
    manualStationId,
    onSlotPreviewChange
  ]);

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
        .select('name, discount_percent')
        .eq('id', vehicle.customer_id)
        .maybeSingle();
      
      if (data?.name) {
        setCustomerName(data.name);
        setSelectedCustomerId(vehicle.customer_id);
      }
      // Set customer discount
      setCustomerDiscountPercent(data?.discount_percent || null);
    } else {
      setCustomerDiscountPercent(null);
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


  // Helper function for scroll-to-first-error
  const scrollToFirstError = (errors: typeof validationErrors) => {
    if (errors.phone && phoneInputRef.current) {
      phoneInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = phoneInputRef.current.querySelector('input');
      if (input) input.focus();
    } else if (errors.carModel && carModelRef.current) {
      carModelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = carModelRef.current.querySelector('input');
      if (input) input.focus();
    } else if (errors.services && servicesRef.current) {
      servicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (errors.dateRange && dateRangeRef.current) {
      dateRangeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (errors.time && timeRef.current) {
      timeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSubmit = async () => {
    // Clear slot preview immediately as first action
    onSlotPreviewChange?.(null);
    
    // Yard mode validation and submit
    if (isYardMode) {
      const errors: typeof validationErrors = {};
      
      if (!phone.trim()) {
        errors.phone = 'Telefon jest wymagany';
      }
      if (!carModel.trim()) {
        errors.carModel = 'Marka i model jest wymagana';
      }
      if (selectedServices.length === 0) {
        errors.services = 'Wybierz co najmniej jedną usługę';
      }
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        scrollToFirstError(errors);
        return;
      }
      setValidationErrors({});
      
      setLoading(true);
      try {
        const vehicleData = {
          instance_id: instanceId,
          customer_name: customerName.trim() || 'Klient',
          customer_phone: normalizePhoneForStorage(phone.trim()) || '',
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
    
    // Reservation mode validation and submit
    const errors: typeof validationErrors = {};
    
    if (!phone.trim()) {
      errors.phone = 'Telefon jest wymagany';
    }
    if (!carModel.trim()) {
      errors.carModel = 'Marka i model jest wymagana';
    }
    if (selectedServices.length === 0) {
      errors.services = 'Wybierz co najmniej jedną usługę';
    }
    if (!dateRange?.from) {
      errors.dateRange = 'Wybierz datę';
    }
    if (!manualStartTime || !manualEndTime || !manualStationId) {
      errors.time = 'Wypełnij wszystkie pola terminu';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      scrollToFirstError(errors);
      return;
    }
    setValidationErrors({});

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
              phone: normalizePhoneForStorage(phone),
              name: customerName,
            })
            .select('id')
            .single();
          
          if (!customerError && newCustomer) {
            customerId = newCustomer.id;
          }
        }
      }

      if (isEditMode && editingReservation) {
        // Update existing reservation
        const updateData = {
          station_id: manualStationId,
          reservation_date: format(dateRange!.from!, 'yyyy-MM-dd'),
          end_date: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
          start_time: manualStartTime,
          end_time: manualEndTime,
          customer_name: customerName.trim() || phone || 'Klient',
          customer_phone: normalizePhoneForStorage(phone) || '',
          vehicle_plate: carModel || '',
          car_size: carSize || null,
          admin_notes: adminNotes.trim() || null,
          price: finalPrice ? parseFloat(finalPrice) : totalPrice,
          service_id: selectedServices[0],
          service_ids: selectedServices,
          service_items: serviceItems.length > 0 ? JSON.parse(JSON.stringify(serviceItems)) : null,
          offer_number: offerNumber || null,
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
          body: `${customerName.trim() || phone || 'Klient'} - ${formatDateForPush(dateRange!.from!)} o ${manualStartTime}`,
          url: `/admin?reservationCode=${editingReservation.confirmation_code || ''}`,
          tag: `edited-reservation-${editingReservation.id}`,
        });

        toast.success(t('addReservation.reservationUpdated'));
      } else {
        // Create new reservation
        const { data: { user } } = await supabase.auth.getUser();
        
        const reservationData = {
          instance_id: instanceId,
          station_id: manualStationId,
          reservation_date: format(dateRange!.from!, 'yyyy-MM-dd'),
          end_date: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
          start_time: manualStartTime,
          end_time: manualEndTime,
          customer_name: customerName.trim() || phone || 'Klient',
          customer_phone: normalizePhoneForStorage(phone) || '',
          vehicle_plate: carModel || '',
          car_size: carSize || null,
          admin_notes: adminNotes.trim() || null,
          price: finalPrice ? parseFloat(finalPrice) : totalPrice,
          service_id: selectedServices[0],
          service_ids: selectedServices,
          service_items: serviceItems.length > 0 ? JSON.parse(JSON.stringify(serviceItems)) : null,
          offer_number: offerNumber || null,
          confirmation_code: Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join(''),
          status: 'confirmed' as const,
          confirmed_at: new Date().toISOString(),
          created_by: user?.id || null,
          created_by_username: currentUsername || null,
          has_unified_services: true,
        };

        const { error: reservationError } = await supabase
          .from('reservations')
          .insert([reservationData]);

        if (reservationError) throw reservationError;

        // Send push notification for new reservation by admin
        sendPushNotification({
          instanceId,
          title: `📅 Nowa rezerwacja (admin)`,
          body: `${customerName.trim() || 'Klient'} - ${formatDateForPush(dateRange!.from!)} o ${manualStartTime}`,
          url: `/admin?reservationCode=${reservationData.confirmation_code}`,
          tag: `new-reservation-admin-${Date.now()}`,
        });

        toast.success(t('addReservation.reservationCreated'));
        
        // Save custom car model as proposal (silently in background)
        if (isCustomCarModel && carModel.trim() && carModel.trim() !== 'BRAK') {
          saveCarModelProposal(carModel.trim(), carSize);
        }
      }
      
      // Pass reservation ID for debounce marking (only in edit mode - new reservations don't have ID yet)
      onSuccess(editingReservation?.id);
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
    .map(s => s.short_name || s.name);

  // Get dialog title based on mode
  const getDialogTitle = () => {
    if (isYardMode) {
      return isEditMode ? t('addReservation.yardEditTitle') : t('addReservation.yardTitle');
    }
    return isEditMode ? t('reservations.editReservation') : t('addReservation.title');
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
                  setCustomerDiscountPercent(null);
                }}
                onSelect={async (customer) => {
                  setCustomerName(customer.name);
                  setPhone(customer.phone);
                  setSelectedCustomerId(customer.id);
                  
                  // Fetch customer discount
                  const { data: customerData } = await supabase
                    .from('customers')
                    .select('discount_percent')
                    .eq('id', customer.id)
                    .maybeSingle();
                  
                  setCustomerDiscountPercent(customerData?.discount_percent || null);
                  
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
                  setCustomerDiscountPercent(null);
                }}
                suppressAutoSearch={isEditMode}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2" ref={phoneInputRef}>
              <div className="flex items-center gap-2">
                <Label>
                  {t('addReservation.customerPhone')} <span className="text-destructive">*</span>
                </Label>
                {searchingCustomer && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <PhoneMaskedInput
                value={phone}
                onChange={(val) => {
                  markUserEditing();
                  setPhone(val);
                  setSelectedCustomerId(null);
                  setCustomerDiscountPercent(null);
                  // Clear validation error when user changes value
                  if (validationErrors.phone) {
                    setValidationErrors(prev => ({ ...prev, phone: undefined }));
                  }
                }}
                className={validationErrors.phone ? 'border-destructive' : ''}
                data-testid="phone-input"
              />
              {validationErrors.phone && (
                <p className="text-sm text-destructive">{validationErrors.phone}</p>
              )}
              
              {/* Phone search results dropdown */}
              {showPhoneDropdown && foundVehicles.length > 0 && (
                <div className="absolute z-50 w-[calc(100%-3rem)] mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {foundVehicles.map((vehicle) => {
                    // Format phone for display (remove +48 prefix, add spaces)
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
            <div className="space-y-2" ref={carModelRef}>
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
                      // Clear validation error when user changes value
                      if (validationErrors.carModel) {
                        setValidationErrors(prev => ({ ...prev, carModel: undefined }));
                      }
                    }}
                    suppressAutoOpen={isEditMode}
                    error={!!validationErrors.carModel}
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
              {validationErrors.carModel && (
                <p className="text-sm text-destructive">{validationErrors.carModel}</p>
              )}
              
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

            {/* Services selection */}
            <div className="space-y-2" ref={servicesRef}>
              <Label>{t('navigation.products')}</Label>
              {validationErrors.services && (
                <p className="text-sm text-destructive">{validationErrors.services}</p>
              )}
              
              {/* Popular service shortcuts - only for yard mode */}
              {isYardMode && services.filter(s => s.is_popular && !selectedServices.includes(s.id)).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {services
                    .filter(s => s.is_popular && !selectedServices.includes(s.id))
                    .map(service => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          markUserEditing();
                          setSelectedServices(prev => [...prev, service.id]);
                        }}
                        className="px-3 py-1.5 text-sm rounded-full transition-colors font-medium bg-muted hover:bg-muted/80 text-foreground border border-border"
                      >
                        {service.short_name || service.name}
                      </button>
                    ))}
                </div>
              )}
              
              {/* Services list with inline price edit */}
              <SelectedServicesList
                services={servicesWithCategory}
                selectedServiceIds={selectedServices}
                serviceItems={serviceItems}
                carSize={carSize}
                onRemoveService={(serviceId) => {
                  markUserEditing();
                  setSelectedServices(prev => prev.filter(id => id !== serviceId));
                  setServiceItems(prev => prev.filter(si => si.service_id !== serviceId));
                  setServicesWithCategory(prev => prev.filter(s => s.id !== serviceId));
                }}
                onPriceChange={(serviceId, price) => {
                  markUserEditing();
                  setServiceItems(prev => {
                    const existing = prev.find(si => si.service_id === serviceId);
                    if (existing) {
                      return prev.map(si => 
                        si.service_id === serviceId 
                          ? { ...si, custom_price: price }
                          : si
                      );
                    }
                    return [...prev, { service_id: serviceId, custom_price: price }];
                  });
                }}
                onTotalPriceChange={(newTotal) => {
                  // Only update finalPrice if it wasn't manually set
                  if (!finalPrice) {
                    setFinalPrice(newTotal.toString());
                  }
                }}
                onAddMore={() => setServiceDrawerOpen(true)}
              />
            </div>

            {/* Service Selection Drawer */}
            <ServiceSelectionDrawer
              open={serviceDrawerOpen}
              onClose={() => setServiceDrawerOpen(false)}
              instanceId={instanceId}
              carSize={carSize}
              selectedServiceIds={selectedServices}
              stationType="universal"
              hasUnifiedServices={!isEditMode}
              onConfirm={(serviceIds, duration, servicesData) => {
                markUserEditing();
                setSelectedServices(serviceIds);
                
                // Clear validation error when user selects services
                if (validationErrors.services) {
                  setValidationErrors(prev => ({ ...prev, services: undefined }));
                }
                
                // Merge new services with existing ones, preserving custom prices
                const newServicesWithCategory = servicesData.filter(
                  s => !servicesWithCategory.some(existing => existing.id === s.id)
                );
                setServicesWithCategory(prev => {
                  // Keep existing services that are still selected
                  const kept = prev.filter(s => serviceIds.includes(s.id));
                  return [...kept, ...newServicesWithCategory];
                });
                
                // Initialize serviceItems for new services (with base price considering net/brutto)
                const existingItemIds = serviceItems.map(si => si.service_id);
                const newItems = serviceIds
                  .filter(id => !existingItemIds.includes(id))
                  .map(id => ({ service_id: id, custom_price: null }));
                
                setServiceItems(prev => {
                  // Keep only items for selected services
                  const kept = prev.filter(si => serviceIds.includes(si.service_id));
                  return [...kept, ...newItems];
                });
              }}
            />

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
                          className="pointer-events-auto"
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
                          className="pointer-events-auto"
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
                    <SelectContent className="bg-white max-h-60">
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

            {/* RESERVATION MODE - Date Range, Start/End Time, Station, Offer Number */}
            {isReservationMode && (
              <div className="space-y-4" ref={dateRangeRef}>
                {/* Date Range Picker */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {t('addReservation.dateRangePpf')} <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange?.from && "text-muted-foreground",
                          validationErrors.dateRange && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? (
                            <>
                              {format(dateRange.from, "d MMM", { locale: pl })} -{" "}
                              {format(dateRange.to, "d MMM yyyy", { locale: pl })}
                            </>
                          ) : (
                            format(dateRange.from, "EEEE, d MMM yyyy", { locale: pl })
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
                          // Clear validation error when user selects date
                          if (validationErrors.dateRange) {
                            setValidationErrors(prev => ({ ...prev, dateRange: undefined }));
                          }
                          if (range?.from && range?.to) {
                            setDateRangeOpen(false);
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
                        numberOfMonths={isMobile ? 1 : 2}
                        locale={pl}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {validationErrors.dateRange && (
                    <p className="text-sm text-destructive">{validationErrors.dateRange}</p>
                  )}
                </div>
                
                {/* Time selection */}
                <div className="space-y-4" ref={timeRef}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manualStartTime">{t('addReservation.manualStartTime')}</Label>
                      <Select value={manualStartTime} onValueChange={(val) => { markUserEditing(); setManualStartTime(val); }}>
                        <SelectTrigger id="manualStartTime" className="bg-white">
                          <SelectValue placeholder="--:--" />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-60">
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
                      <Select value={manualEndTime} onValueChange={(val) => { markUserEditing(); setUserModifiedEndTime(true); setManualEndTime(val); }}>
                        <SelectTrigger id="manualEndTime" className="bg-white">
                          <SelectValue placeholder="--:--" />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-60">
                          {endTimeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Station selector */}
                  <div className="space-y-2">
                    <Label htmlFor="manualStation">{t('addReservation.selectStation')} <span className="text-destructive">*</span></Label>
                    <Select value={manualStationId || ''} onValueChange={setManualStationId}>
                      <SelectTrigger className={cn(validationErrors.time && !manualStationId && "border-destructive")}>
                        <SelectValue placeholder={t('addReservation.selectStation')} />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {stations.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {validationErrors.time && (
                    <p className="text-sm text-destructive">{validationErrors.time}</p>
                  )}
                </div>
                
                {/* Offer number */}
                <div className="space-y-2">
                  <Label>
                    {t('addReservation.offerNumber')} <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
                  </Label>
                  <OfferSearchAutocomplete
                    instanceId={instanceId}
                    value={offerNumber}
                    onChange={setOfferNumber}
                    onOfferSelect={(offer) => {
                      setOfferNumber(offer.offer_number);
                      // Optionally pre-fill customer data if not already filled
                      if (!customerName && offer.customer_name) {
                        setCustomerName(offer.customer_name);
                      }
                      if (!phone && offer.customer_phone) {
                        setPhone(offer.customer_phone);
                      }
                      if (!carModel && offer.vehicle_model) {
                        setCarModel(offer.vehicle_model);
                      }
                    }}
                    placeholder={t('addReservation.offerNumberPlaceholder')}
                  />
                </div>
              </div>
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

            {/* Final Price - visible in reservation mode */}
            {isReservationMode && (
              <div className="space-y-2">
                <Label htmlFor="finalPrice" className="text-sm text-muted-foreground">
                  {t('addReservation.amount')}
                </Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    id="finalPrice"
                    type="number"
                    value={finalPrice || discountedPrice}
                    onChange={(e) => setFinalPrice(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">zł</span>
                  {customerDiscountPercent && customerDiscountPercent > 0 && totalPrice > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="line-through text-muted-foreground">{totalPrice} zł</span>
                      <span className="text-green-600 font-medium">-{customerDiscountPercent}%</span>
                    </div>
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
            disabled={loading} 
            className="w-full"
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isYardMode 
              ? (isEditMode ? t('addReservation.saveYardChanges') : t('addReservation.addYardVehicle'))
              : (isEditMode ? t('addReservation.saveChanges') : t('addReservation.addReservation'))
            }
          </Button>
        </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Mobile FAB to toggle drawer visibility */}
      {isMobile && open && (
        <button
          type="button"
          onClick={() => setIsDrawerHidden(!isDrawerHidden)}
          className={cn(
            "fixed z-[60] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all",
            isDrawerHidden ? "bottom-20 right-4" : "bottom-20 left-4"
          )}
        >
          {isDrawerHidden ? (
            <ClipboardPaste className="w-6 h-6" />
          ) : (
            <CalendarIcon className="w-6 h-6" />
          )}
        </button>
      )}
    </>
  );
};

export default AddReservationDialogV2;
