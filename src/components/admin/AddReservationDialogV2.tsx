import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInstanceSettings } from '@/hooks/useInstanceSettings';
import { useEmployees } from '@/hooks/useEmployees';
import { Loader2, X, CalendarIcon, ClipboardPaste, Plus, Users, ChevronDown, GraduationCap } from 'lucide-react';
import { format, addDays, isSameDay, isBefore, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter } from
'@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn, generateTimeSlots, getWorkingHoursRange } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { sendPushNotification, formatDateForPush } from '@/lib/pushNotifications';
import { normalizePhone as normalizePhoneForStorage } from '@/lib/phoneUtils';
import ServiceSelectionDrawer, { ServiceWithCategory } from './ServiceSelectionDrawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SelectedServicesList, { ServiceItem } from './SelectedServicesList';
import { EmployeeSelectionDrawer } from './EmployeeSelectionDrawer';
import { AssignedEmployeesChips } from './AssignedEmployeesChips';
import {
  CustomerSection,
  VehicleSection,
  YardDateTimeSection,
  ReservationDateTimeSection,
  NotesAndPriceSection } from
'./reservation-form';

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
  has_unified_services?: boolean | null;
  assigned_employee_ids?: string[] | null;
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
  /** Trainings feature props */
  trainingsEnabled?: boolean;
  onSwitchToTraining?: () => void;
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
  trainingsEnabled = false,
  onSwitchToTraining
}: AddReservationDialogV2Props) => {
  const isYardMode = mode === 'yard';
  const isReservationMode = mode === 'reservation';
  const isEditMode = isYardMode ? !!editingYardVehicle : !!editingReservation?.id;

  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // Employee assignment feature
  const { data: instanceSettings } = useInstanceSettings(instanceId);
  const showEmployeeAssignment = isReservationMode && (instanceSettings?.assign_employees_to_reservations ?? false);
  const { data: employees = [] } = useEmployees(instanceId);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);
  const employeesDirtyRef = useRef(false);
  const employeesSyncedFromBackendForReservationIdRef = useRef<string | null>(null);
  const [isDrawerHidden, setIsDrawerHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<{
    phone?: string;
    carModel?: string;
    services?: string;
    time?: string;
    station?: string;
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
  // Track if user manually modified the finalPrice (dirty check)
  const [userModifiedFinalPrice, setUserModifiedFinalPrice] = useState(false);
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

  // Reservation type: single (1 day) or multi (date range)
  const [reservationType, setReservationType] = useState<'single' | 'multi'>('single');

  // Fetch services and stations on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;

      // Fetch services based on has_unified_services flag:
      // - unified (has_unified_services=true) → only 'both'
      // - legacy (has_unified_services=false) → only 'reservation'
      const serviceTypeFilter = editingReservation?.has_unified_services === false ?
      'reservation' :
      'both';

      const servicesQuery = supabase.
      from('unified_services').
      select('id, name, short_name, category_id, duration_minutes, duration_small, duration_medium, duration_large, price_from, price_small, price_medium, price_large, station_type, is_popular').
      eq('instance_id', instanceId).
      eq('service_type', serviceTypeFilter).
      eq('active', true);

      const { data: servicesData } = await servicesQuery.order('sort_order');

      if (servicesData) {
        setServices(servicesData);
      }

      // Fetch all active stations (for reservation mode)
      if (isReservationMode) {
        const { data: stationsData } = await supabase.
        from('stations').
        select('id, name, type').
        eq('instance_id', instanceId).
        eq('active', true).
        order('sort_order');

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
      setUserModifiedFinalPrice(false);
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
        const serviceIds = editingReservation.service_ids && editingReservation.service_ids.length > 0 ?
        editingReservation.service_ids :
        editingReservation.service_id ? [editingReservation.service_id] : [];
        setSelectedServices(serviceIds);

        // Load servicesWithCategory from services list for backwards compatibility
        if (services.length > 0 && serviceIds.length > 0) {
          const loadedServicesWithCategory: ServiceWithCategory[] = [];
          serviceIds.forEach((id) => {
            const service = services.find((s) => s.id === id);
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
                category_prices_are_net: false
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
          setServiceItems(serviceIds.map((id) => ({ service_id: id, custom_price: null })));
        }

        // Date range - use reservation_date and end_date (handle empty for prefill mode)
        if (editingReservation.reservation_date) {
          const fromDate = new Date(editingReservation.reservation_date);
          const toDate = editingReservation.end_date ? new Date(editingReservation.end_date) : fromDate;
          setDateRange({ from: fromDate, to: toDate });

          // Auto-detect reservation type based on date range
          if (editingReservation.end_date &&
          editingReservation.reservation_date !== editingReservation.end_date) {
            setReservationType('multi');
          } else {
            setReservationType('single');
          }
        } else {
          // No date provided (e.g. creating from offer) - use next working day
          const nextDay = getNextWorkingDay();
          setDateRange({ from: nextDay, to: nextDay });
          setReservationType('single');
        }

        setAdminNotes(editingReservation.admin_notes || '');
        setFinalPrice(editingReservation.price?.toString() || '');
        // Mark as user-modified if editing reservation with existing price
        setUserModifiedFinalPrice(!!editingReservation.price);
        setOfferNumber(editingReservation.offer_number || '');
        setFoundVehicles([]);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setCustomerDiscountPercent(null);
        setShowPhoneDropdown(false);
        setShowCustomerDropdown(false);
        setCustomerVehicles([]);
        setSelectedVehicleId(null);

        // Set manual time from editing reservation (skip if empty - e.g. prefill from offer)
        const startTimeStr = editingReservation.start_time?.substring(0, 5) || '';
        const endTimeStr = editingReservation.end_time?.substring(0, 5) || '';
        if (startTimeStr) setManualStartTime(startTimeStr);
        if (endTimeStr) setManualEndTime(endTimeStr);
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

        // Initialize assigned employees from reservation (optimistic) + allow backend to re-hydrate
        employeesDirtyRef.current = false;
        employeesSyncedFromBackendForReservationIdRef.current = null;
        setAssignedEmployeeIds(editingReservation.assigned_employee_ids || []);
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
            const service = services.find((s) => s.id === serviceId);
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
          setReservationType('single');
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
          employeesDirtyRef.current = false;
          employeesSyncedFromBackendForReservationIdRef.current = null;
          setAssignedEmployeeIds([]);
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
        setReservationType('single');
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
        employeesDirtyRef.current = false;
        employeesSyncedFromBackendForReservationIdRef.current = null;
        setAssignedEmployeeIds([]);
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


  // Keep employee assignments in sync with backend when opening edit mode
  useEffect(() => {
    const reservationId = editingReservation?.id;
    if (!open || !reservationId || !showEmployeeAssignment) return;

    // Only once per reservation open - prevents loops
    if (employeesSyncedFromBackendForReservationIdRef.current === reservationId) return;
    employeesSyncedFromBackendForReservationIdRef.current = reservationId;

    (async () => {
      const { data, error } = await supabase.
      from('reservations').
      select('assigned_employee_ids').
      eq('id', reservationId).
      maybeSingle();

      if (error) return;
      if (employeesDirtyRef.current) return;

      const raw = (data as any)?.assigned_employee_ids;
      const ids = Array.isArray(raw) ? raw as string[] : [];
      setAssignedEmployeeIds(ids);
    })();
  }, [open, editingReservation?.id, showEmployeeAssignment]);

  // NEW: Re-map servicesWithCategory when services are loaded (for edit mode)
  useEffect(() => {
    if (!open || services.length === 0) return;

    // Skip if servicesWithCategory is already populated (user already editing)
    if (servicesWithCategory.length > 0) return;

    // Handle reservation edit mode
    if (editingReservation) {
      const serviceIds = editingReservation.service_ids && editingReservation.service_ids.length > 0 ?
      editingReservation.service_ids :
      editingReservation.service_id ? [editingReservation.service_id] : [];

      if (serviceIds.length === 0) return;

      const loadedServicesWithCategory: ServiceWithCategory[] = [];
      serviceIds.forEach((id) => {
        const service = services.find((s) => s.id === id);
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
            category_prices_are_net: false
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
    const service = services.find((s) => s.id === serviceId);
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
    const service = services.find((s) => s.id === serviceId);
    if (!service) return total;

    // Check if there's a custom price in serviceItems
    const serviceItem = serviceItems.find((si) => si.service_id === serviceId);
    if (serviceItem?.custom_price !== null && serviceItem?.custom_price !== undefined) {
      return total + serviceItem.custom_price;
    }

    return total + getServicePrice(service);
  }, 0);

  // Calculate discounted price
  const discountedPrice = customerDiscountPercent && customerDiscountPercent > 0 ?
  Math.round(totalPrice * (1 - customerDiscountPercent / 100)) :
  totalPrice;

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
        stationId: manualStationId
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
  onSlotPreviewChange]
  );

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
      const { data, error } = await supabase.
      from('customer_vehicles').
      select('id, phone, model, plate, customer_id').
      eq('instance_id', instanceId).
      or(`phone.ilike.%${normalizedSearch}%`).
      order('last_used_at', { ascending: false }).
      limit(5);

      if (!error && data) {
        const customerIds = data.filter((v) => v.customer_id).map((v) => v.customer_id!);
        let customerNames: Record<string, string> = {};

        if (customerIds.length > 0) {
          const { data: customersData } = await supabase.
          from('customers').
          select('id, name').
          in('id', customerIds);

          if (customersData) {
            customersData.forEach((c) => {
              customerNames[c.id] = c.name;
            });
          }
        }

        const vehiclesWithNames: CustomerVehicle[] = data.map((v) => ({
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
      const { data } = await supabase.
      from('customer_vehicles').
      select('id, phone, model, plate, customer_id, car_size, last_used_at').
      eq('instance_id', instanceId).
      or(`phone.eq.${normalized},phone.eq.+48${normalized}`).
      order('last_used_at', { ascending: false });

      if (data && data.length > 0) {
        setCustomerVehicles(data);
        // Default select the first (most recently used)
        setSelectedVehicleId(data[0].id);
        // Auto-fill model from first vehicle
        setCarModel(data[0].model);
        // Set car size
        if (data[0].car_size === 'S') setCarSize('small');else
        if (data[0].car_size === 'L') setCarSize('large');else
        setCarSize('medium');
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
    const { data: vehicleData } = await supabase.
    from('customer_vehicles').
    select('car_size').
    eq('id', vehicle.id).
    maybeSingle();

    if (vehicleData?.car_size) {
      if (vehicleData.car_size === 'S') setCarSize('small');else
      if (vehicleData.car_size === 'L') setCarSize('large');else
      setCarSize('medium');
    }

    if (vehicle.customer_id) {
      const { data } = await supabase.
      from('customers').
      select('name, discount_percent').
      eq('id', vehicle.customer_id).
      maybeSingle();

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

  // Dynamic time range based on working hours for selected day
  const { min: timeMin, max: timeMax } = getWorkingHoursRange(workingHours, dateRange?.from);
  const startTimeOptions = generateTimeSlots(timeMin, timeMax, 15);
  const endTimeOptions = generateTimeSlots(timeMin, timeMax, 15);

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
      await supabase.
      from('car_models').
      upsert({
        brand,
        name: name || brand,
        size,
        status: 'proposal',
        active: true
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
          notes: adminNotes.trim() || null
        };

        if (editingYardVehicle) {
          const { error } = await supabase.
          from('yard_vehicles').
          update(vehicleData).
          eq('id', editingYardVehicle.id);

          if (error) throw error;
          toast.success(t('addReservation.yardVehicleUpdated'));
        } else {
          const { error } = await supabase.
          from('yard_vehicles').
          insert({
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
    if (!manualStartTime || !manualEndTime) {
      errors.time = 'Wybierz godzinę rozpoczęcia i zakończenia';
    }
    if (!manualStationId && (isEditMode || initialStationId === undefined)) {
      errors.station = 'Wybierz stanowisko';
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
        const normalizedPhone = normalizePhoneForStorage(phone);
        const { data: existingCustomer } = await supabase.
        from('customers').
        select('id, name').
        eq('instance_id', instanceId).
        eq('phone', normalizedPhone).
        limit(1).
        maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Update name if changed
          if (customerName.trim() !== existingCustomer.name) {
            const normalizedName = customerName.trim();
            // Update customer record
            await supabase.
            from('customers').
            update({ name: normalizedName }).
            eq('id', existingCustomer.id);
            // Also update customer_name in all existing reservations for this customer
            await supabase.
            from('reservations').
            update({ customer_name: normalizedName }).
            eq('instance_id', instanceId).
            eq('customer_phone', normalizedPhone);
          }
        } else {
          const { data: newCustomer, error: customerError } = await supabase.
          from('customers').
          insert({
            instance_id: instanceId,
            phone: normalizedPhone,
            name: customerName
          }).
          select('id').
          single();

          if (!customerError && newCustomer) {
            customerId = newCustomer.id;
          }
        }
      }

      // Enrich service_items with names before saving (ensure no "Usługa" fallback)
      const enrichedServiceItems = serviceItems.map(si => {
        if (si.name) return si;
        const svc = servicesWithCategory.find(s => s.id === si.service_id);
        return { ...si, name: svc?.name, short_name: svc?.short_name };
      });

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
          service_id: editingReservation.has_unified_services ? null : selectedServices[0],
          service_ids: selectedServices,
          service_items: enrichedServiceItems.length > 0 ? JSON.parse(JSON.stringify(enrichedServiceItems)) : null,
          offer_number: offerNumber || null,
          assigned_employee_ids: assignedEmployeeIds.length > 0 ? assignedEmployeeIds : null
        };

        const { error: updateError } = await supabase.
        from('reservations').
        update(updateData).
        eq('id', editingReservation.id);

        if (updateError) throw updateError;

        // Upsert customer vehicle (silently in background)
        if (carModel && carModel.trim() && carModel.trim() !== 'BRAK' && phone) {
          const carSizeCode = carSize === 'small' ? 'S' : carSize === 'large' ? 'L' : 'M';
          (async () => {
            try {
              await supabase.rpc('upsert_customer_vehicle', {
                _instance_id: instanceId,
                _phone: normalizePhoneForStorage(phone),
                _model: carModel.trim(),
                _plate: null,
                _customer_id: customerId || null,
                _car_size: carSizeCode
              });
              console.log('Customer vehicle upserted on edit:', carModel);
            } catch (err) {
              console.error('Failed to upsert customer vehicle:', err);
            }
          })();
        }

        // Send push notification for edit
        sendPushNotification({
          instanceId,
          title: `✏️ Rezerwacja zmieniona`,
          body: `${customerName.trim() || phone || 'Klient'} - ${formatDateForPush(dateRange!.from!)} o ${manualStartTime}`,
          url: `/admin?reservationCode=${editingReservation.confirmation_code || ''}`,
          tag: `edited-reservation-${editingReservation.id}`
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
          service_id: null,
          service_ids: selectedServices,
          service_items: enrichedServiceItems.length > 0 ? JSON.parse(JSON.stringify(enrichedServiceItems)) : null,
          offer_number: offerNumber || null,
          confirmation_code: Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join(''),
          status: 'confirmed' as const,
          confirmed_at: new Date().toISOString(),
          created_by: user?.id || null,
          created_by_username: currentUsername || null,
          has_unified_services: true,
          assigned_employee_ids: assignedEmployeeIds.length > 0 ? assignedEmployeeIds : null
        };

        const { error: reservationError } = await supabase.
        from('reservations').
        insert([reservationData]);

        if (reservationError) throw reservationError;

        // Send push notification for new reservation by admin
        sendPushNotification({
          instanceId,
          title: `📅 Nowa rezerwacja (admin)`,
          body: `${customerName.trim() || 'Klient'} - ${formatDateForPush(dateRange!.from!)} o ${manualStartTime}`,
          url: `/admin?reservationCode=${reservationData.confirmation_code}`,
          tag: `new-reservation-admin-${Date.now()}`
        });

        toast.success(t('addReservation.reservationCreated'));

        // Upsert customer vehicle (silently in background)
        if (carModel && carModel.trim() && carModel.trim() !== 'BRAK' && phone) {
          const carSizeCode = carSize === 'small' ? 'S' : carSize === 'large' ? 'L' : 'M';
          (async () => {
            try {
              await supabase.rpc('upsert_customer_vehicle', {
                _instance_id: instanceId,
                _phone: normalizePhoneForStorage(phone),
                _model: carModel.trim(),
                _plate: null,
                _customer_id: customerId || null,
                _car_size: carSizeCode
              });
              console.log('Customer vehicle upserted on create:', carModel);
            } catch (err) {
              console.error('Failed to upsert customer vehicle:', err);
            }
          })();
        }

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
  const selectedServiceNames = services.
  filter((s) => selectedServices.includes(s.id)).
  map((s) => s.short_name || s.name);

  // Get dialog title based on mode
  const getDialogTitle = () => {
    if (isYardMode) {
      return isEditMode ? t('addReservation.yardEditTitle') : t('addReservation.yardTitle');
    }
    return isEditMode ? t('reservations.editReservation') : t('addReservation.title');
  };

  // Show dropdown for switching to training when conditions met
  const showTrainingDropdown = trainingsEnabled && !editingReservation && mode === 'reservation';

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
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}>

          {/* Fixed Header with Close button */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              {showTrainingDropdown ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-lg font-semibold text-foreground hover:text-primary transition-colors">
                      {getDialogTitle()}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem className="font-medium">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {t('addReservation.title')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSwitchToTraining?.()}>
                      <GraduationCap className="w-4 h-4 mr-2" />
                      {t('trainings.newTraining')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SheetTitle>
                  {getDialogTitle()}
                </SheetTitle>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors">

                <X className="w-6 h-6" />
              </button>
            </div>
          </SheetHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {/* Customer Section */}
              <CustomerSection
                instanceId={instanceId}
                customerName={customerName}
                onCustomerNameChange={(val) => {
                  markUserEditing();
                  setCustomerName(val);
                }}
                phone={phone}
                onPhoneChange={(val) => {
                  markUserEditing();
                  setPhone(val);
                  setSelectedCustomerId(null);
                  setCustomerDiscountPercent(null);
                  if (validationErrors.phone) {
                    setValidationErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                phoneError={validationErrors.phone}
                searchingCustomer={searchingCustomer}
                foundVehicles={foundVehicles}
                showPhoneDropdown={showPhoneDropdown}
                onSelectVehicle={(vehicle) => {
                  markUserEditing();
                  selectVehicle(vehicle);
                }}
                onCustomerSelect={async (customer) => {
                  markUserEditing();
                  setCustomerName(customer.name);
                  setPhone(customer.phone);
                  setSelectedCustomerId(customer.id);
                  const { data: customerData } = await supabase.
                  from('customers').
                  select('discount_percent').
                  eq('id', customer.id).
                  maybeSingle();
                  setCustomerDiscountPercent(customerData?.discount_percent || null);
                }}
                onClearCustomer={() => {
                  setSelectedCustomerId(null);
                  setCustomerDiscountPercent(null);
                }}
                suppressAutoSearch={isEditMode}
                phoneInputRef={phoneInputRef}
                setCarModel={setCarModel}
                setCarSize={setCarSize} />


              {/* Vehicle Section */}
              <VehicleSection
                carModel={carModel}
                onCarModelChange={(val) => {
                  markUserEditing();
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
                      if (val.size === 'S') setCarSize('small');else
                      if (val.size === 'M') setCarSize('medium');else
                      if (val.size === 'L') setCarSize('large');
                    }
                  }
                  if (validationErrors.carModel) {
                    setValidationErrors((prev) => ({ ...prev, carModel: undefined }));
                  }
                }}
                carSize={carSize}
                onCarSizeChange={(size) => {
                  markUserEditing();
                  setCarSize(size);
                }}
                carModelError={validationErrors.carModel}
                customerVehicles={customerVehicles}
                selectedVehicleId={selectedVehicleId}
                onVehicleSelect={(vehicle) => {
                  markUserEditing();
                  setSelectedVehicleId(vehicle.id);
                  setCarModel(vehicle.model);
                  if (vehicle.car_size === 'S') setCarSize('small');else
                  if (vehicle.car_size === 'L') setCarSize('large');else
                  setCarSize('medium');
                }}
                suppressAutoOpen={isEditMode}
                carModelRef={carModelRef} />


              {/* Services Section */}
              <div className="space-y-2" ref={servicesRef}>
                <Label className="flex items-center gap-2">
                  {t('addReservation.services')} <span className="text-destructive">*</span>
                </Label>
                
                {validationErrors.services &&
                <p className="text-sm text-destructive">{validationErrors.services}</p>
                }

                {/* Popular service shortcuts - quick add pills */}
                {services.filter((s) => s.is_popular && !selectedServices.includes(s.id)).length > 0 &&
                <div className="flex flex-wrap gap-2">
                    {services.
                  filter((s) => s.is_popular && !selectedServices.includes(s.id)).
                  map((service) =>
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      markUserEditing();
                      setSelectedServices((prev) => [...prev, service.id]);
                      // Add to servicesWithCategory if not already there
                      if (!servicesWithCategory.some((s) => s.id === service.id)) {
                        setServicesWithCategory((prev) => [...prev, {
                          id: service.id,
                          name: service.name,
                          short_name: service.short_name,
                          category_id: service.category_id,
                          category_name: null,
                          duration_minutes: service.duration_minutes,
                          duration_small: service.duration_small,
                          duration_medium: service.duration_medium,
                          duration_large: service.duration_large,
                          price_from: service.price_from,
                          price_small: service.price_small,
                          price_medium: service.price_medium,
                          price_large: service.price_large,
                          station_type: service.station_type
                        }]);
                      }
                      // Initialize service item with name metadata
                      if (!serviceItems.some((si) => si.service_id === service.id)) {
                        setServiceItems((prev) => [...prev, { service_id: service.id, custom_price: null, name: service.name, short_name: service.short_name }]);
                      }
                    }}
                    className="px-3 py-1.5 text-sm rounded-full transition-colors font-medium text-primary-foreground bg-secondary">

                          {service.short_name || service.name}
                        </button>
                  )}
                  </div>
                }
                
                {/* Services list with inline price edit */}
                <SelectedServicesList
                  services={servicesWithCategory}
                  selectedServiceIds={selectedServices}
                  serviceItems={serviceItems}
                  carSize={carSize}
                  onRemoveService={(serviceId) => {
                    markUserEditing();
                    setSelectedServices((prev) => prev.filter((id) => id !== serviceId));
                    setServiceItems((prev) => prev.filter((si) => si.service_id !== serviceId));
                    setServicesWithCategory((prev) => prev.filter((s) => s.id !== serviceId));
                  }}
                  onPriceChange={(serviceId, price) => {
                    markUserEditing();
                    setServiceItems((prev) => {
                      const existing = prev.find((si) => si.service_id === serviceId);
                      if (existing) {
                        return prev.map((si) =>
                        si.service_id === serviceId ?
                        { ...si, custom_price: price } :
                        si
                        );
                      }
                      return [...prev, { service_id: serviceId, custom_price: price }];
                    });
                  }}
                  onTotalPriceChange={(newTotal) => {
                    // Only auto-update finalPrice if user hasn't manually modified it
                    if (!userModifiedFinalPrice) {
                      setFinalPrice(newTotal.toString());
                    }
                  }}
                  onAddMore={() => setServiceDrawerOpen(true)} />

              </div>

              {/* Service Selection Drawer */}
              <ServiceSelectionDrawer
                open={serviceDrawerOpen}
                onClose={() => setServiceDrawerOpen(false)}
                instanceId={instanceId}
                carSize={carSize}
                selectedServiceIds={selectedServices}
                stationType="universal"
                hasUnifiedServices={isEditMode ? editingReservation?.has_unified_services ?? false : true}
                hideSelectedSection={true}
                onConfirm={(serviceIds, duration, servicesData) => {
                  markUserEditing();
                  setSelectedServices(serviceIds);

                  if (validationErrors.services) {
                    setValidationErrors((prev) => ({ ...prev, services: undefined }));
                  }

                  const newServicesWithCategory = servicesData.filter(
                    (s) => !servicesWithCategory.some((existing) => existing.id === s.id)
                  );
                  setServicesWithCategory((prev) => {
                    const kept = prev.filter((s) => serviceIds.includes(s.id));
                    return [...kept, ...newServicesWithCategory];
                  });

                  const existingItemIds = serviceItems.map((si) => si.service_id);
                  const newItems = serviceIds.
                  filter((id) => !existingItemIds.includes(id)).
                  map((id) => {
                    const svc = servicesData.find((s) => s.id === id) || servicesWithCategory.find((s) => s.id === id);
                    return {
                      service_id: id,
                      custom_price: null,
                      name: svc?.name || undefined,
                      short_name: svc?.short_name || undefined
                    };
                  });

                  setServiceItems((prev) => {
                    const kept = prev.filter((si) => serviceIds.includes(si.service_id));
                    return [...kept, ...newItems];
                  });
                }} />


              <Separator className="my-2" />

              {/* YARD MODE - Date/Time Section */}
              {isYardMode &&
              <YardDateTimeSection
                arrivalDate={arrivalDate}
                setArrivalDate={setArrivalDate}
                arrivalDateOpen={arrivalDateOpen}
                setArrivalDateOpen={setArrivalDateOpen}
                pickupDate={pickupDate}
                setPickupDate={setPickupDate}
                pickupDateOpen={pickupDateOpen}
                setPickupDateOpen={setPickupDateOpen}
                deadlineTime={deadlineTime}
                setDeadlineTime={setDeadlineTime}
                timeOptions={yardTimeOptions} />

              }

              {/* RESERVATION MODE - Date/Time Section */}
              {isReservationMode &&
              <ReservationDateTimeSection
                instanceId={instanceId}
                reservationType={reservationType}
                setReservationType={setReservationType}
                dateRange={dateRange}
                setDateRange={setDateRange}
                dateRangeOpen={dateRangeOpen}
                setDateRangeOpen={setDateRangeOpen}
                dateRangeError={validationErrors.dateRange}
                onClearDateRangeError={() => setValidationErrors((prev) => ({ ...prev, dateRange: undefined }))}
                manualStartTime={manualStartTime}
                setManualStartTime={setManualStartTime}
                manualEndTime={manualEndTime}
                setManualEndTime={setManualEndTime}
                setUserModifiedEndTime={setUserModifiedEndTime}
                manualStationId={manualStationId}
                setManualStationId={setManualStationId}
                stations={stations}
                startTimeOptions={startTimeOptions}
                endTimeOptions={endTimeOptions}
                timeError={validationErrors.time || validationErrors.station}
                offerNumber={offerNumber}
                setOfferNumber={setOfferNumber}
                customerName={customerName}
                setCustomerName={setCustomerName}
                phone={phone}
                setPhone={setPhone}
                carModel={carModel}
                setCarModel={setCarModel}
                workingHours={workingHours}
                isMobile={isMobile}
                markUserEditing={markUserEditing}
                dateRangeRef={dateRangeRef}
                timeRef={timeRef}
                showStationSelector={isEditMode || initialStationId === undefined} />

              }

              {/* Assigned Employees Section - visible when feature enabled */}
              {showEmployeeAssignment &&
              <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Przypisani pracownicy
                  </Label>
                  <AssignedEmployeesChips
                  employeeIds={assignedEmployeeIds}
                  employees={employees}
                  onRemove={(id) => setAssignedEmployeeIds((prev) => prev.filter((e) => e !== id))}
                  onAdd={() => setEmployeeDrawerOpen(true)}
                  variant="blue" />

                </div>
              }

              {/* Notes and Price Section */}
              <NotesAndPriceSection
                adminNotes={adminNotes}
                setAdminNotes={setAdminNotes}
                showPrice={isReservationMode}
                finalPrice={finalPrice}
                setFinalPrice={setFinalPrice}
                totalPrice={totalPrice}
                discountedPrice={discountedPrice}
                customerDiscountPercent={customerDiscountPercent}
                markUserEditing={markUserEditing}
                onFinalPriceUserEdit={() => setUserModifiedFinalPrice(true)} />

            </div>
          </div>

          {/* Fixed Footer */}
          <SheetFooter className="px-6 py-4 border-t shrink-0">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full">

              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isYardMode ?
              isEditMode ? t('addReservation.saveYardChanges') : t('addReservation.addYardVehicle') :
              isEditMode ? t('addReservation.saveChanges') : t('addReservation.addReservation')
              }
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Mobile FAB to toggle drawer visibility - always on the right */}
      {isMobile && open &&
      <button
        type="button"
        onClick={() => setIsDrawerHidden(!isDrawerHidden)}
        className="fixed z-[60] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center bottom-20 right-4">

          {isDrawerHidden ?
        <ClipboardPaste className="w-6 h-6" /> :

        <CalendarIcon className="w-6 h-6" />
        }
        </button>
      }
      
      {/* Employee Selection Drawer */}
      <EmployeeSelectionDrawer
        open={employeeDrawerOpen}
        onOpenChange={setEmployeeDrawerOpen}
        instanceId={instanceId}
        selectedEmployeeIds={assignedEmployeeIds}
        onSelect={(employeeIds) => {
          employeesDirtyRef.current = true;
          markUserEditing();
          setAssignedEmployeeIds(employeeIds);
        }} />

    </>);

};

export default AddReservationDialogV2;