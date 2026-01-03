import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, Car, Loader2, Sparkles, Check, ChevronDown, CalendarIcon, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import { pl } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type CarSize = 'small' | 'medium' | 'large';

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
}

interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

interface ExistingReservation {
  id: string;
  station_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
}

interface ExistingBreak {
  id: string;
  station_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
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
  car_size?: 'small' | 'medium' | 'large' | null;
  reservation_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  station_id: string | null;
  service_ids?: string[];
  service_id?: string;
  notes?: string;
  price?: number | null;
}

interface YardVehicle {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size: CarSize | null;
  service_ids: string[];
  arrival_date: string;
  deadline_time: string | null;
  notes: string | null;
}

interface AddReservationDialogProps {
  open: boolean;
  onClose: () => void;
  stationId?: string;
  stationType?: string;
  date?: string;
  time?: string;
  instanceId: string;
  onSuccess: () => void;
  existingReservations?: ExistingReservation[];
  existingBreaks?: ExistingBreak[];
  workingHours?: Record<string, WorkingHours | null> | null;
  /** Optional reservation to edit - when provided, dialog works in edit mode */
  editingReservation?: EditingReservation | null;
  /** Mode: 'reservation' (default) or 'yard' for yard vehicle management */
  mode?: 'reservation' | 'yard';
  /** Yard vehicle to edit when mode='yard' */
  editingYardVehicle?: YardVehicle | null;
}

// CAR_SIZE_LABELS moved inside component for i18n

const AddReservationDialog = ({
  open,
  onClose,
  stationId,
  stationType,
  date = '',
  time = '',
  instanceId,
  onSuccess,
  existingReservations = [],
  existingBreaks = [],
  workingHours = null,
  editingReservation = null,
  mode = 'reservation',
  editingYardVehicle = null,
}: AddReservationDialogProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  const isYardMode = mode === 'yard';
  const isEditMode = isYardMode ? !!editingYardVehicle : !!editingReservation;

  const CAR_SIZE_LABELS: Record<CarSize, string> = {
    small: t('reservations.carSizes.small'),
    medium: t('reservations.carSizes.medium'),
    large: t('reservations.carSizes.large'),
  };
  const [pendingAutoSubmit, setPendingAutoSubmit] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [suggestingSize, setSuggestingSize] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [foundVehicles, setFoundVehicles] = useState<CustomerVehicle[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize>('medium');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(time);
  const [endTime, setEndTime] = useState('');
  const [manualDuration, setManualDuration] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Date range for PPF stations - start with undefined to allow full selection
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  
  // PPF specific fields
  const [offerNumber, setOfferNumber] = useState('');
  const [notes, setNotes] = useState('');
  
  // Yard mode fields
  const [arrivalDate, setArrivalDate] = useState<Date>(new Date());
  const [arrivalDateOpen, setArrivalDateOpen] = useState(false);
  const [deadlineTime, setDeadlineTime] = useState('');
  
  const isPPFStation = stationType === 'ppf';

  // Helper function to get working hours for a specific date
  const getWorkingHoursForDate = (dateStr: string): WorkingHours | null => {
    if (!workingHours) return null;
    
    const dateObj = new Date(dateStr);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dateObj.getDay()];
    
    return workingHours[dayName] || null;
  };

  // Get max end time for PPF based on end date working hours
  const ppfEndDateWorkingHours = dateRange?.to 
    ? getWorkingHoursForDate(format(dateRange.to, 'yyyy-MM-dd'))
    : null;
  
  const ppfMaxEndTime = ppfEndDateWorkingHours?.close || '19:00';
  // Fetch services on mount
  useEffect(() => {
    const fetchServices = async () => {
      let query = supabase
        .from('services')
        .select('id, name, shortcut, duration_minutes, duration_small, duration_medium, duration_large, price_from, price_small, price_medium, price_large, station_type, is_popular')
        .eq('instance_id', instanceId)
        .eq('active', true);
      
      // Filter by station type if specified
      if (stationType && ['washing', 'ppf', 'detailing', 'universal'].includes(stationType)) {
        query = query.eq('station_type', stationType as 'washing' | 'ppf' | 'detailing' | 'universal');
      }
      
      const { data, error } = await query.order('sort_order');
      
      if (!error && data) {
        setServices(data);
      }
    };
    
    if (open && instanceId) {
      fetchServices();
    }
  }, [open, instanceId, stationType]);

  // Reset form when dialog opens or populate with editing data
  useEffect(() => {
    if (open) {
      if (isYardMode && editingYardVehicle) {
        // Yard edit mode - populate with yard vehicle data
        setCustomerName(editingYardVehicle.customer_name || '');
        setPhone(editingYardVehicle.customer_phone || '');
        setCarModel(editingYardVehicle.vehicle_plate || '');
        setCarSize(editingYardVehicle.car_size || 'medium');
        setSelectedServices(editingYardVehicle.service_ids || []);
        setArrivalDate(new Date(editingYardVehicle.arrival_date));
        setDeadlineTime(editingYardVehicle.deadline_time || '');
        setNotes(editingYardVehicle.notes || '');
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowCustomerDropdown(false);
        setServicesOpen(false);
        setErrors({});
      } else if (isYardMode) {
        // Yard create mode - reset for yard
        setCustomerName('');
        setPhone('');
        setCarModel('');
        setCarSize('medium');
        setSelectedServices([]);
        setArrivalDate(new Date());
        setDeadlineTime('');
        setNotes('');
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowCustomerDropdown(false);
        setServicesOpen(false);
        setErrors({});
      } else if (editingReservation) {
        // Edit mode - populate with existing reservation data
        setCustomerName(editingReservation.customer_name || '');
        setPhone(editingReservation.customer_phone || '');
        setCarModel(editingReservation.vehicle_plate || '');
        setCarSize(editingReservation.car_size || 'medium');
        const serviceIds = editingReservation.service_ids || (editingReservation.service_id ? [editingReservation.service_id] : []);
        setSelectedServices(serviceIds);
        setStartTime(editingReservation.start_time?.substring(0, 5) || time);
        setEndTime(editingReservation.end_time?.substring(0, 5) || '');
        
        // Calculate duration from start and end times
        if (editingReservation.start_time && editingReservation.end_time) {
          const [startH, startM] = editingReservation.start_time.split(':').map(Number);
          const [endH, endM] = editingReservation.end_time.split(':').map(Number);
          const durationMins = (endH * 60 + endM) - (startH * 60 + startM);
          setManualDuration(durationMins > 0 ? durationMins : null);
        } else {
          setManualDuration(stationType === 'washing' ? 30 : null);
        }
        
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowCustomerDropdown(false);
        setServicesOpen(false);
        
        // Set date range for PPF
        if (isPPFStation && editingReservation.reservation_date) {
          const fromDate = new Date(editingReservation.reservation_date);
          const toDate = editingReservation.end_date ? new Date(editingReservation.end_date) : fromDate;
          setDateRange({ from: fromDate, to: toDate });
        } else {
          setDateRange(undefined);
        }
        setDateRangeOpen(false);
        
        // Extract offer number from notes for PPF
        if (isPPFStation && editingReservation.notes) {
          const offerMatch = editingReservation.notes.match(/Oferta:\s*([^\n]+)/);
          if (offerMatch) {
            setOfferNumber(offerMatch[1].trim());
            setNotes(editingReservation.notes.replace(/Oferta:\s*[^\n]+\n?/, '').trim());
          } else {
            setOfferNumber('');
            setNotes(editingReservation.notes);
          }
        } else {
          setOfferNumber('');
          setNotes(editingReservation.notes || '');
        }
        
        setErrors({});
      } else {
        // Create mode - reset everything
        setCustomerName('');
        setPhone('');
        setCarModel('');
        setCarSize('medium');
        setSelectedServices([]);
        setStartTime(time);
        setEndTime('');
        setManualDuration(stationType === 'washing' ? 30 : null);
        setFoundCustomers([]);
        setSelectedCustomerId(null);
        setShowCustomerDropdown(false);
        setServicesOpen(false);
        setDateRange(undefined);
        setDateRangeOpen(false);
        setOfferNumber('');
        setNotes('');
        setArrivalDate(new Date());
        setDeadlineTime('');
        setErrors({});
      }
    }
  }, [open, time, date, stationType, editingReservation, isPPFStation, isYardMode, editingYardVehicle]);

  // Get duration and price for selected car size
  const getServiceDuration = (service: Service): number => {
    if (carSize === 'small' && service.duration_small) return service.duration_small;
    if (carSize === 'large' && service.duration_large) return service.duration_large;
    if (carSize === 'medium' && service.duration_medium) return service.duration_medium;
    return service.duration_minutes || 60;
  };

  const getServicePrice = (service: Service): number | null => {
    if (carSize === 'small' && service.price_small) return service.price_small;
    if (carSize === 'large' && service.price_large) return service.price_large;
    if (carSize === 'medium' && service.price_medium) return service.price_medium;
    return service.price_from;
  };

  // Calculate total duration from selected services based on car size
  const totalDurationMinutes = selectedServices.reduce((total, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return total + (service ? getServiceDuration(service) : 0);
  }, 0);

  // Generate time slots based on working hours (15min intervals)
  const generateTimeSlots = (): string[] => {
    const dayWorkingHours = getWorkingHoursForDate(date);
    const openTime = dayWorkingHours?.open || '08:00';
    const closeTime = dayWorkingHours?.close || '18:00';
    
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const startMinutes = openH * 60 + openM;
    const endMinutes = closeH * 60 + closeM;
    
    const slots: string[] = [];
    for (let m = startMinutes; m < endMinutes; m += 15) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Base duration options for dropdown (15min increments from 30min to 4h)
  const BASE_DURATION_OPTIONS = [
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1h' },
    { value: 75, label: '1h 15min' },
    { value: 90, label: '1h 30min' },
    { value: 105, label: '1h 45min' },
    { value: 120, label: '2h' },
    { value: 135, label: '2h 15min' },
    { value: 150, label: '2h 30min' },
    { value: 180, label: '3h' },
    { value: 210, label: '3h 30min' },
    { value: 240, label: '4h' },
  ];

  // Calculate max available minutes until next reservation/break on this station
  const maxAvailableMinutes = (() => {
    if (!stationId || !date || !startTime) return null;
    
    const [startHours, startMins] = startTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMins;

    // Get all blocks (reservations + breaks) for this station on this date that start AFTER our start time
    const reservationBlocks = existingReservations
      .filter(r => r.station_id === stationId && r.reservation_date === date)
      .map(r => {
        const [h, m] = r.start_time.split(':').map(Number);
        return h * 60 + m;
      });

    const breakBlocks = existingBreaks
      .filter(b => b.station_id === stationId && b.break_date === date)
      .map(b => {
        const [h, m] = b.start_time.split(':').map(Number);
        return h * 60 + m;
      });

    const allBlocks = [...reservationBlocks, ...breakBlocks]
      .filter(blockStart => blockStart > startTotalMinutes) // Only blocks that start after our start time
      .sort((a, b) => a - b);

    if (allBlocks.length === 0) return null; // No limit from other reservations
    
    const nextBlockStart = allBlocks[0];
    return nextBlockStart - startTotalMinutes;
  })();

  // Filter duration options based on max available time (only up to maxAvailableMinutes)
  // Red options (+15 and +30 beyond max) are added separately in the dropdown
  const DURATION_OPTIONS = maxAvailableMinutes !== null
    ? BASE_DURATION_OPTIONS.filter(opt => opt.value <= maxAvailableMinutes)
    : BASE_DURATION_OPTIONS;

  // Effective duration: manual override or service-based
  const effectiveDuration = manualDuration ?? (totalDurationMinutes > 0 ? totalDurationMinutes : null);

  // Calculate end time based on effective duration
  useEffect(() => {
    if (startTime && effectiveDuration && effectiveDuration > 0) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + effectiveDuration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      setEndTime(`${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`);
    } else if (!effectiveDuration) {
      setEndTime('');
    }
  }, [startTime, effectiveDuration]);

  // Handle manual duration change
  const handleDurationChange = (value: string) => {
    const duration = parseInt(value);
    setManualDuration(duration);
  };

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newServices = prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      
      // Clear error when service is selected
      if (newServices.length > 0 && errors.services) {
        setErrors(prev => {
          const { services, ...rest } = prev;
          return rest;
        });
      }
      
      return newServices;
    });
  };

  // AI suggestion for car size
  const suggestCarSize = useCallback(async (model: string) => {
    if (model.trim().length < 3) return;
    
    setSuggestingSize(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-car-size', {
        body: { carModel: model }
      });
      
      if (!error && data?.size) {
        setCarSize(data.size);
      }
    } catch (err) {
      console.error('Error suggesting car size:', err);
    } finally {
      setSuggestingSize(false);
    }
  }, []);

  // Debounced car model change for AI suggestion
  useEffect(() => {
    if (!carModel || carModel.length < 3) return;
    
    const timer = setTimeout(() => {
      suggestCarSize(carModel);
    }, 500);
    return () => clearTimeout(timer);
  }, [carModel, suggestCarSize]);

  // Search customer by phone
  const searchByPhone = useCallback(async (searchPhone: string) => {
    if (searchPhone.length < 3) {
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
        .ilike('phone', `%${searchPhone}%`)
        .order('last_used_at', { ascending: false })
        .limit(5);
      
      if (!error && data) {
        // Fetch customer names for vehicles with customer_id
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
        
        // Merge customer names into vehicles
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

  // Debounced phone search (disabled in edit mode)
  useEffect(() => {
    if (selectedCustomerId || editingReservation) return; // Don't search if customer already selected or in edit mode
    
    const timer = setTimeout(() => {
      searchByPhone(phone);
    }, 300);
    return () => clearTimeout(timer);
  }, [phone, searchByPhone, selectedCustomerId, editingReservation]);

  const selectVehicle = async (vehicle: CustomerVehicle) => {
    setPhone(vehicle.phone);
    setCarModel(vehicle.model);
    setShowPhoneDropdown(false);
    
    // Fetch customer name if we have customer_id
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
    
    // Trigger AI car size suggestion
    if (vehicle.model && vehicle.model.length >= 3) {
      suggestCarSize(vehicle.model);
    }
  };

  // Search customer by name
  const searchCustomer = useCallback(async (searchName: string) => {
    if (searchName.length < 2) {
      setFoundCustomers([]);
      setShowCustomerDropdown(false);
      return;
    }
    
    setSearchingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, name, email')
        .eq('instance_id', instanceId)
        .ilike('name', `%${searchName}%`)
        .limit(5);
      
      if (!error && data) {
        setFoundCustomers(data);
        setShowCustomerDropdown(data.length > 0);
      }
    } finally {
      setSearchingCustomer(false);
    }
  }, [instanceId]);

  // Debounced name search (disabled in edit mode)
  useEffect(() => {
    if (selectedCustomerId || editingReservation) return; // Don't search if customer already selected or in edit mode
    
    const timer = setTimeout(() => {
      searchCustomer(customerName);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, searchCustomer, selectedCustomerId, editingReservation]);

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setSelectedCustomerId(customer.id);
    setFoundCustomers([]);
    setShowCustomerDropdown(false);
  };

  const generateConfirmationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async () => {
    // Validate required fields
    const newErrors: Record<string, string> = {};
    
    // Yard mode validation
    if (isYardMode) {
      if (!customerName.trim()) {
        toast.error(t('addReservation.customerNameRequired'));
        return;
      }
      if (!phone.trim()) {
        toast.error(t('addReservation.phoneRequired'));
        return;
      }
      if (!carModel.trim()) {
        toast.error(t('addReservation.carModelRequired'));
        return;
      }
      if (selectedServices.length === 0) {
        newErrors.services = t('addReservation.selectAtLeastOneService');
      }
      
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      
      setErrors({});
      setLoading(true);
      
      try {
        const vehicleData = {
          instance_id: instanceId,
          customer_name: customerName.trim(),
          customer_phone: phone.trim(),
          vehicle_plate: carModel.trim(),
          car_size: carSize || null,
          service_ids: selectedServices,
          arrival_date: format(arrivalDate, 'yyyy-MM-dd'),
          deadline_time: deadlineTime || null,
          notes: notes.trim() || null,
        };

        if (editingYardVehicle) {
          // Update existing
          const { error } = await supabase
            .from('yard_vehicles')
            .update(vehicleData)
            .eq('id', editingYardVehicle.id);

          if (error) throw error;
          toast.success(t('addReservation.yardVehicleUpdated'));
        } else {
          // Insert new
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
    
    // Regular reservation validation
    // Service is required for washing stations, optional for others
    const isWashingStation = stationType === 'washing';
    if (isWashingStation && selectedServices.length === 0) {
      newErrors.services = t('addReservation.selectAtLeastOneService');
    }
    
    // For non-washing stations without selected service, we need a placeholder service
    // since service_id is required in the database
    
    if (!stationId) {
      toast.error(t('addReservation.noStation'));
      return;
    }
    
    // If there are validation errors, show them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Clear errors
    setErrors({});

    // Calculate end time if not set but services are selected
    let finalEndTime = endTime;
    if (!finalEndTime && selectedServices.length > 0 && startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + totalDurationMinutes;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      finalEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    }
    
    // Default end time if still not set (1 hour from start)
    if (!finalEndTime && startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + 60;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      finalEndTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    }

    setLoading(true);
    try {
      // Create customer if name provided and not already selected
      let customerId = selectedCustomerId;
      
      if (customerName && !customerId) {
        // Check if customer with this phone exists (if phone provided)
        if (phone) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('instance_id', instanceId)
            .eq('phone', phone)
            .maybeSingle();
          
          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            // Create new customer
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert({
                instance_id: instanceId,
                phone,
                name: customerName,
              })
              .select('id')
              .single();
            
          if (customerError) throw customerError;
            customerId = newCustomer.id;
          }
        } else {
          // Create customer without phone
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              instance_id: instanceId,
              phone: '', // Empty phone
              name: customerName,
            })
            .select('id')
            .single();
          
          if (customerError) throw customerError;
          customerId = newCustomer.id;
        }
      }

      // Create reservation
      const reservationDate = isPPFStation && dateRange?.from 
        ? format(dateRange.from, 'yyyy-MM-dd')
        : date;
      
      const endDate = isPPFStation && dateRange?.to 
        ? format(dateRange.to, 'yyyy-MM-dd')
        : null;

      // Build notes field - for PPF include offer number
      let reservationNotes = '';
      if (isPPFStation) {
        if (offerNumber) {
          reservationNotes = `Oferta: ${offerNumber}`;
        }
        if (notes) {
          reservationNotes = reservationNotes ? `${reservationNotes}\n${notes}` : notes;
        }
      }

      const reservationData: any = {
        station_id: stationId,
        reservation_date: reservationDate,
        end_date: endDate,
        start_time: startTime,
        end_time: finalEndTime,
        customer_name: customerName || t('addReservation.defaultCustomer'),
        customer_phone: phone || '',
        vehicle_plate: carModel || '',
        car_size: carSize || null,
        notes: reservationNotes || null,
      };

      // Set service_id - required field in database (first service)
      // Also store all selected services in service_ids
      if (selectedServices.length > 0) {
        reservationData.service_id = selectedServices[0];
        reservationData.service_ids = selectedServices;
      } else {
        // For non-washing stations without service selection, get first available service for this station type
        const matchingService = services.find(s => s.station_type === stationType);
        if (matchingService) {
          reservationData.service_id = matchingService.id;
          reservationData.service_ids = [matchingService.id];
        } else if (services.length > 0) {
          // Fallback to first available service
          reservationData.service_id = services[0].id;
          reservationData.service_ids = [services[0].id];
        } else {
          toast.error(t('addReservation.noServicesAvailable'));
          setLoading(false);
          return;
        }
      }

      if (isEditMode && editingReservation) {
        // Update existing reservation
        const { error: reservationError } = await supabase
          .from('reservations')
          .update(reservationData)
          .eq('id', editingReservation.id);

        if (reservationError) throw reservationError;

        toast.success(t('reservations.reservationUpdated'), {
          description: (
            <div className="flex flex-col">
              <span>{startTime} - {finalEndTime}</span>
              <span>{carModel || t('addReservation.defaultVehicle')}</span>
            </div>
          ),
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        });
      } else {
        // Create new reservation
        reservationData.instance_id = instanceId;
        reservationData.confirmation_code = generateConfirmationCode();
        reservationData.status = 'confirmed';

        const { error: reservationError } = await supabase
          .from('reservations')
          .insert(reservationData);

        if (reservationError) throw reservationError;

        toast.success(t('addReservation.reservationCreated'), {
          description: (
            <div className="flex flex-col">
              <span>{startTime} - {finalEndTime}</span>
              <span>{carModel || t('addReservation.defaultVehicle')}</span>
            </div>
          ),
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving reservation:', error);
      toast.error(isEditMode ? t('errors.generic') : t('addReservation.reservationError'));
    } finally {
      setLoading(false);
    }
  };

  // Handle voice input parsed data
  const handleVoiceParsed = (data: {
    customerName?: string | null;
    phone?: string | null;
    carModel?: string | null;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    serviceName?: string | null;
    shouldConfirm?: boolean;
  }) => {
    if (data.customerName) setCustomerName(data.customerName);
    if (data.phone) setPhone(data.phone);
    if (data.carModel) setCarModel(data.carModel);
    if (data.startTime) setStartTime(data.startTime);
    if (data.endTime) setEndTime(data.endTime);
    
    // Find matching service by name
    if (data.serviceName) {
      const matchingService = services.find(s => 
        s.name.toLowerCase().includes(data.serviceName!.toLowerCase()) ||
        data.serviceName!.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matchingService) {
        setSelectedServices([matchingService.id]);
      }
    }
    
    // Handle date for PPF stations
    if (data.date && isPPFStation) {
      setDateRange({ from: new Date(data.date), to: undefined });
    }
    
    // Auto-submit if user said "zatwierdź"
    if (data.shouldConfirm) {
      setPendingAutoSubmit(true);
    }
  };
  
  // Effect to handle auto-submit after voice parsing
  useEffect(() => {
    if (pendingAutoSubmit && !loading) {
      setPendingAutoSubmit(false);
      // Small delay to allow state updates to propagate
      const timer = setTimeout(() => {
        handleSubmit();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pendingAutoSubmit, loading]);

  // Generate time options (every 15 min) for yard deadline
  const yardTimeOptions = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      yardTimeOptions.push(timeStr);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isYardMode 
              ? (isEditMode ? t('addReservation.yardEditTitle') : t('addReservation.yardTitle'))
              : (isEditMode ? t('reservations.editReservation') : t('addReservation.title'))
            }
          </DialogTitle>
          <DialogDescription>
            {isYardMode 
              ? t('addReservation.yardDescription')
              : (isEditMode ? t('reservations.editReservation') : t('addReservation.formDescription'))
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Yard mode: Arrival Date and Deadline */}
          {isYardMode ? (
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
                      {arrivalDate ? format(arrivalDate, 'PPP', { locale: pl }) : t('addReservation.selectDate')}
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
          ) : isPPFStation ? (
            /* Date and Time Info - with range picker for PPF */
            <div className="space-y-3">
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
                    defaultMonth={dateRange?.from || (date ? new Date(date) : new Date())}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      // Close picker when both dates are selected
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ppfStartTime">
                    {t('addReservation.startTime')}
                  </Label>
                  <Input
                    id="ppfStartTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ppfEndTime" className="flex items-center gap-2">
                    <span className="flex-1">{t('addReservation.endTime')}</span>
                    {dateRange?.to && ppfEndDateWorkingHours && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({t('addReservation.max')} {ppfMaxEndTime})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="ppfEndTime"
                    type="time"
                    value={endTime}
                    max={ppfMaxEndTime}
                    onChange={(e) => {
                      const newEndTime = e.target.value;
                      // Validate against working hours
                      if (newEndTime > ppfMaxEndTime) {
                        toast.error(t('addReservation.endTimeError', { time: ppfMaxEndTime }));
                        setEndTime(ppfMaxEndTime);
                      } else {
                        setEndTime(newEndTime);
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('addReservation.multiDayHint')}
              </p>
            </div>
          ) : (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('common.date')}:</span>{' '}
                <span className="font-medium">
                  {date && format(new Date(date), 'EEEE, d MMMM yyyy', { locale: pl })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('addReservation.time')}:</span>{' '}
                <span className="font-medium">{time}</span>
              </div>
            </div>
          )}

          {/* Customer Name / Alias - Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('addReservation.customerNameAlias')}
            </Label>
            <div className="relative">
              <Input
                id="name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomerId(null);
                }}
                className="pr-10"
                autoComplete="off"
              />
              {searchingCustomer && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Customer suggestions dropdown */}
            {showCustomerDropdown && foundCustomers.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-card shadow-lg z-50">
                {foundCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border last:border-0"
                    onClick={() => selectCustomer(customer)}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {customer.name} <span className="text-muted-foreground">[{customer.phone}]</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Phone - with autocomplete from database */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {t('common.phone')}
            </Label>
            <div className="relative">
              <Input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSelectedCustomerId(null);
                }}
                className="pr-10"
                autoComplete="off"
              />
              {searchingCustomer && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Vehicle suggestions dropdown */}
            {showPhoneDropdown && foundVehicles.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-card shadow-lg z-50">
                {foundVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border last:border-0"
                    onClick={() => selectVehicle(vehicle)}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {vehicle.customer_name || vehicle.phone}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {vehicle.phone}{vehicle.model && ` • ${vehicle.model}`}{vehicle.plate && ` • ${vehicle.plate}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Car Model + Car Size (S/M/L) in one row */}
          <div className="space-y-2">
            <Label htmlFor="carModel" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              {t('reservations.carModel')}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <CarSearchAutocomplete
                  value={carModel}
                  onChange={(val: CarSearchValue) => {
                    if (val === null) {
                      setCarModel('');
                    } else if ('type' in val && val.type === 'custom') {
                      setCarModel(val.label);
                    } else {
                      setCarModel(val.label);
                      // Auto-set car size based on selected model
                      if ('size' in val) {
                        if (val.size === 'S') setCarSize('small');
                        else if (val.size === 'M') setCarSize('medium');
                        else if (val.size === 'L') setCarSize('large');
                      }
                    }
                  }}
                  placeholder="np. BMW X5"
                />
                {suggestingSize && (
                  <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-pulse text-primary" />
                )}
                {suggestingSize && (
                  <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-pulse text-primary" />
                )}
              </div>
              
              {/* Car Size - compact S/M/L buttons */}
              <TooltipProvider>
                <div className="flex gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant={carSize === 'small' ? 'default' : 'outline'}
                        className="w-9 h-9 font-bold p-0"
                        onClick={() => setCarSize('small')}
                      >
                        S
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{t('reservations.carSizes.small')}</p>
                      <p className="text-xs text-muted-foreground">Fiat 500, Smart, Mini</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant={carSize === 'medium' ? 'default' : 'outline'}
                        className="w-9 h-9 font-bold p-0"
                        onClick={() => setCarSize('medium')}
                      >
                        M
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{t('reservations.carSizes.medium')}</p>
                      <p className="text-xs text-muted-foreground">Golf, A4, 3 Series</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant={carSize === 'large' ? 'default' : 'outline'}
                        className="w-9 h-9 font-bold p-0"
                        onClick={() => setCarSize('large')}
                      >
                        L
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{t('reservations.carSizes.large')}</p>
                      <p className="text-xs text-muted-foreground">SUV, Van, Kombi</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>

          {/* Services Multi-Select - shown for yard mode and non-PPF stations */}
          {(isYardMode || !isPPFStation) && (
            <div className="space-y-2">
              <Label className={cn(
                "flex items-center justify-between",
                errors.services && "text-destructive"
              )}>
                <span>{t('addReservation.services')} <span className="text-destructive">*</span></span>
                {selectedServices.length > 0 && (
                  <span className="text-sm font-normal text-primary">
                    {t('addReservation.total')}: {totalDurationMinutes} min
                  </span>
                )}
              </Label>
              
              {/* Services input + shortcut chips in one row */}
              <div className="flex gap-2 items-center">
                {/* Autocomplete dropdown - narrower input */}
                <Popover open={servicesOpen} onOpenChange={setServicesOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={servicesOpen}
                      className={cn(
                        "flex-1 justify-between font-normal",
                        errors.services && "border-destructive ring-destructive focus:ring-destructive"
                      )}
                    >
                      {selectedServices.length === 0 
                        ? t('addReservation.selectServices') 
                        : t('addReservation.servicesSelected', { count: selectedServices.length })}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start" onWheel={(e) => e.stopPropagation()}>
                    {/* Search input */}
                    <div className="p-2 border-b border-border">
                      <Input
                        placeholder={t('addReservation.searchServicePlaceholder')}
                        className="h-9"
                        onChange={(e) => {
                          const searchValue = e.target.value.toLowerCase();
                          // Find matching service by shortcut or name
                          if (searchValue.length >= 2) {
                            const matchingService = services.find(s => 
                              s.shortcut?.toLowerCase() === searchValue ||
                              s.name.toLowerCase().includes(searchValue)
                            );
                            if (matchingService && !selectedServices.includes(matchingService.id)) {
                              toggleService(matchingService.id);
                              e.target.value = '';
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const searchValue = (e.target as HTMLInputElement).value.toLowerCase();
                            const matchingService = services.find(s => 
                              s.shortcut?.toLowerCase() === searchValue ||
                              s.name.toLowerCase().includes(searchValue)
                            );
                            if (matchingService) {
                              toggleService(matchingService.id);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto overscroll-contain p-2 space-y-1">
                      {services.map((service) => {
                        const isSelected = selectedServices.includes(service.id);
                        return (
                          <div
                            key={service.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
                              isSelected && "bg-primary/10"
                            )}
                            onClick={() => toggleService(service.id)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleService(service.id)}
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-sm truncate">{service.name}</span>
                                {service.shortcut && (
                                  <span className="text-xs text-primary font-semibold shrink-0">{service.shortcut}</span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {getServiceDuration(service)} min
                                {getServicePrice(service) && ` • ${getServicePrice(service)} zł`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Popular/Quick service chips - next to dropdown */}
                {(() => {
                  const popularServices = services.filter(s => s.is_popular);
                  const displayServices = popularServices.length > 0 ? popularServices : services.slice(0, 2);
                  return displayServices.length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {displayServices.map((service) => {
                        const isSelected = selectedServices.includes(service.id);
                        return (
                          <Button
                            key={service.id}
                            type="button"
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            className="w-auto px-3 h-9 font-bold"
                            onClick={() => toggleService(service.id)}
                          >
                            {service.shortcut || service.name}
                          </Button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              
              {errors.services && (
                <p className="text-sm text-destructive">{errors.services}</p>
              )}
            </div>
          )}
          {/* PPF specific fields - Offer Number and Notes */}
          {isPPFStation && (
            <>
              <div className="space-y-2">
                <Label htmlFor="offerNumber">{t('addReservation.offerNumber')}</Label>
                <Input
                  id="offerNumber"
                  value={offerNumber}
                  onChange={(e) => setOfferNumber(e.target.value)}
                  placeholder={t('addReservation.offerNumberPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ppfNotes">{t('common.notes')}</Label>
                <Input
                  id="ppfNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('addReservation.additionalInfoPlaceholder')}
                />
              </div>
            </>
          )}

          {/* Time and Duration - hidden for PPF and Yard mode */}
          {!isPPFStation && !isYardMode && (
            <div className="space-y-2">
              <Label>{t('addReservation.timeAndDuration')}</Label>
              <div className="flex items-center gap-2">
                {/* Start Time - 15min intervals dropdown */}
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-muted-foreground">{t('addReservation.from')}</span>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('addReservation.selectTime')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Duration dropdown with +15/+30 as options inside */}
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-muted-foreground">{t('addReservation.duration')}</span>
                  <Select 
                    value={manualDuration?.toString() || ''} 
                    onValueChange={handleDurationChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('addReservation.selectDuration')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                      {/* Extra options showing time beyond maxAvailableMinutes - only when there's a limit */}
                      {maxAvailableMinutes !== null && (() => {
                        const overlapOption1 = maxAvailableMinutes + 15;
                        const overlapOption2 = maxAvailableMinutes + 30;
                        
                        const formatDuration = (mins: number) => {
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          if (h === 0) return `${m} min`;
                          if (m === 0) return `${h}h`;
                          return `${h}h ${m}min`;
                        };
                        
                        return (
                          <>
                            <SelectItem 
                              value={overlapOption1.toString()} 
                              className="text-destructive font-medium border-t border-border"
                            >
                              {formatDuration(overlapOption1)}
                            </SelectItem>
                            <SelectItem 
                              value={overlapOption2.toString()} 
                              className="text-destructive font-medium"
                            >
                              {formatDuration(overlapOption2)}
                            </SelectItem>
                          </>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* End Time - 15min intervals dropdown */}
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-muted-foreground">{t('addReservation.to')}</span>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="--:--" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Max available time hint */}
              {maxAvailableMinutes !== null && (
                <p className="text-xs text-muted-foreground">
                  {t('addReservation.max')} {maxAvailableMinutes >= 60 
                    ? `${Math.floor(maxAvailableMinutes / 60)}h${maxAvailableMinutes % 60 > 0 ? ` ${maxAvailableMinutes % 60}min` : ''}` 
                    : `${maxAvailableMinutes}min`} {t('addReservation.toNextReservation')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-row gap-2 sm:justify-end border-t pt-4 mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1 sm:flex-none">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1 sm:flex-none">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditMode ? t('common.save') : t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddReservationDialog;
