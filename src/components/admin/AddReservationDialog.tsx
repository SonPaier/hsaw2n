import { useState, useEffect, useCallback } from 'react';
import { User, Phone, Car, Clock, Loader2, Sparkles, Check, ChevronDown, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type CarSize = 'small' | 'medium' | 'large';

interface Service {
  id: string;
  name: string;
  duration_minutes: number | null;
  price_from: number | null;
  station_type: string | null;
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

interface AddReservationDialogProps {
  open: boolean;
  onClose: () => void;
  stationId: string;
  stationType?: string;
  date: string;
  time: string;
  instanceId: string;
  onSuccess: () => void;
  existingReservations?: ExistingReservation[];
  existingBreaks?: ExistingBreak[];
  workingHours?: Record<string, WorkingHours | null> | null;
}

const CAR_SIZE_LABELS: Record<CarSize, string> = {
  small: 'Mały (np. Fiat 500, VW Polo)',
  medium: 'Średni (np. VW Golf, BMW 3)',
  large: 'Duży (np. BMW X5, Audi Q7)',
};

const AddReservationDialog = ({
  open,
  onClose,
  stationId,
  stationType,
  date,
  time,
  instanceId,
  onSuccess,
  existingReservations = [],
  existingBreaks = [],
  workingHours = null,
}: AddReservationDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [suggestingSize, setSuggestingSize] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
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
      const { data, error } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price_from, station_type')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      
      if (!error && data) {
        setServices(data);
      }
    };
    
    if (open && instanceId) {
      fetchServices();
    }
  }, [open, instanceId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCustomerName('');
      setPhone('');
      setCarModel('');
      setCarSize('');
      setSelectedServices([]);
      setStartTime(time);
      setEndTime('');
      // Set default duration to 30 minutes for washing stations
      setManualDuration(stationType === 'washing' ? 30 : null);
      setFoundCustomers([]);
      setSelectedCustomerId(null);
      setShowCustomerDropdown(false);
      setServicesOpen(false);
      setDateRange(undefined); // Reset to allow fresh selection
      setDateRangeOpen(false);
      setOfferNumber('');
      setNotes('');
      setErrors({}); // Reset validation errors
    }
  }, [open, time, date, stationType]);

  // Calculate total duration from selected services
  const totalDurationMinutes = selectedServices.reduce((total, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return total + (service?.duration_minutes || 0);
  }, 0);

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

  // Filter duration options based on max available time
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

  // Debounced name search
  useEffect(() => {
    if (selectedCustomerId) return; // Don't search if customer already selected
    
    const timer = setTimeout(() => {
      searchCustomer(customerName);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, searchCustomer, selectedCustomerId]);

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
    
    // Service is required for washing stations, optional for others
    const isWashingStation = stationType === 'washing';
    if (isWashingStation && selectedServices.length === 0) {
      newErrors.services = 'Wybierz przynajmniej jedną usługę';
    }
    
    // For non-washing stations without selected service, we need a placeholder service
    // since service_id is required in the database
    
    if (!stationId) {
      toast.error('Brak stanowiska');
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
            toast.success('Dodano nowego klienta do bazy');
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
          toast.success('Dodano nowego klienta do bazy');
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
        instance_id: instanceId,
        station_id: stationId,
        reservation_date: reservationDate,
        end_date: endDate,
        start_time: startTime,
        end_time: finalEndTime,
        customer_name: customerName || 'Bez nazwy',
        customer_phone: phone || '',
        vehicle_plate: carModel || '', // Using vehicle_plate field for car model temporarily
        car_size: carSize || null,
        confirmation_code: generateConfirmationCode(),
        status: 'confirmed',
        notes: reservationNotes || null,
      };

      // Set service_id - required field in database
      if (selectedServices.length > 0) {
        reservationData.service_id = selectedServices[0];
      } else {
        // For non-washing stations without service selection, get first available service for this station type
        const matchingService = services.find(s => s.station_type === stationType);
        if (matchingService) {
          reservationData.service_id = matchingService.id;
        } else if (services.length > 0) {
          // Fallback to first available service
          reservationData.service_id = services[0].id;
        } else {
          toast.error('Brak dostępnych usług w systemie');
          setLoading(false);
          return;
        }
      }

      const { error: reservationError } = await supabase
        .from('reservations')
        .insert(reservationData);

      if (reservationError) throw reservationError;

      toast.success('Rezerwacja została dodana');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Błąd podczas tworzenia rezerwacji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Nowa rezerwacja
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date and Time Info - with range picker for PPF */}
          {isPPFStation ? (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Zakres dat (folia - rezerwacja wielodniowa)
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
                      <span>Wybierz zakres dat</span>
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
                  <Label htmlFor="ppfStartTime">Godzina rozpoczęcia</Label>
                  <Input
                    id="ppfStartTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ppfEndTime" className="flex items-center justify-between">
                    <span>Godzina zakończenia</span>
                    {dateRange?.to && ppfEndDateWorkingHours && (
                      <span className="text-xs text-muted-foreground">
                        (max {ppfMaxEndTime} - {format(dateRange.to, 'EEEE', { locale: pl })})
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
                        toast.error(`Godzina zakończenia nie może być późniejsza niż ${ppfMaxEndTime}`);
                        setEndTime(ppfMaxEndTime);
                      } else {
                        setEndTime(newEndTime);
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Dla rezerwacji wielodniowych: godzina rozpoczęcia dotyczy pierwszego dnia, godzina zakończenia - ostatniego dnia.
              </p>
            </div>
          ) : (
            <div className="flex gap-4 p-3 bg-muted/50 rounded-lg text-sm">
              <div>
                <span className="text-muted-foreground">Data:</span>{' '}
                <span className="font-medium">{date}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Godzina:</span>{' '}
                <span className="font-medium">{time}</span>
              </div>
            </div>
          )}

          {/* Customer Name / Alias - Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Imię i nazwisko / Alias
            </Label>
            <div className="relative">
              <Input
                id="name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomerId(null);
                }}
                placeholder="Jan Kowalski"
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

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Numer telefonu
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="123 456 789"
            />
          </div>

          {/* Car Model */}
          <div className="space-y-2">
            <Label htmlFor="carModel" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Model samochodu
            </Label>
            <div className="relative">
              <Input
                id="carModel"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                placeholder="np. BMW X5, Audi A4"
                className="pr-10"
              />
              {suggestingSize && (
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-pulse text-primary" />
              )}
            </div>
          </div>

          {/* Car Size */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Wielkość samochodu
              {suggestingSize && (
                <span className="text-xs text-muted-foreground">(AI sugeruje...)</span>
              )}
            </Label>
            <Select value={carSize} onValueChange={(v) => setCarSize(v as CarSize)}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz wielkość" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="small">{CAR_SIZE_LABELS.small}</SelectItem>
                <SelectItem value="medium">{CAR_SIZE_LABELS.medium}</SelectItem>
                <SelectItem value="large">{CAR_SIZE_LABELS.large}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Services Multi-Select - hidden for PPF */}
          {!isPPFStation && (
            <div className="space-y-2">
              <Label className={cn(
                "flex items-center justify-between",
                errors.services && "text-destructive"
              )}>
                <span>Usługi *</span>
                {selectedServices.length > 0 && (
                  <span className="text-sm font-normal text-primary">
                    Suma: {totalDurationMinutes} min
                  </span>
                )}
              </Label>
              <Popover open={servicesOpen} onOpenChange={setServicesOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={servicesOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      errors.services && "border-destructive ring-destructive focus:ring-destructive"
                    )}
                  >
                    {selectedServices.length === 0 
                      ? "Wybierz usługi..." 
                      : `Wybrano ${selectedServices.length} usług`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-popover" align="start" onWheel={(e) => e.stopPropagation()}>
                  <div className="max-h-60 overflow-y-auto overscroll-contain p-2 space-y-1">
                    {services.map((service) => {
                      const isSelected = selectedServices.includes(service.id);
                      return (
                        <div
                          key={service.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
                            isSelected && "bg-primary/10"
                          )}
                          onClick={() => toggleService(service.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleService(service.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{service.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {service.duration_minutes} min
                              {service.price_from && ` • od ${service.price_from} zł`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {errors.services && (
                <p className="text-sm text-destructive">{errors.services}</p>
              )}
            </div>
          )}
          {/* PPF specific fields - Offer Number and Notes */}
          {isPPFStation && (
            <>
              <div className="space-y-2">
                <Label htmlFor="offerNumber">Numer oferty</Label>
                <Input
                  id="offerNumber"
                  value={offerNumber}
                  onChange={(e) => setOfferNumber(e.target.value)}
                  placeholder="np. OF-2024-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ppfNotes">Notatki</Label>
                <Input
                  id="ppfNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dodatkowe informacje..."
                />
              </div>
            </>
          )}

          {/* Time Range - hidden for PPF as it's already in the date range section */}
          {!isPPFStation && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Godzina rozpoczęcia</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Godzina zakończenia</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setManualDuration(null); // Reset manual duration when end time is manually changed
                    }}
                    placeholder="Automatycznie"
                  />
                </div>
              </div>
              
              {/* Duration Quick Select */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Czas trwania</span>
                  <div className="flex items-center gap-2">
                    {maxAvailableMinutes !== null && (
                      <span className="text-xs text-muted-foreground">
                        (max {maxAvailableMinutes >= 60 
                          ? `${Math.floor(maxAvailableMinutes / 60)}h${maxAvailableMinutes % 60 > 0 ? ` ${maxAvailableMinutes % 60}min` : ''}` 
                          : `${maxAvailableMinutes}min`} do następnej rezerwacji)
                      </span>
                    )}
                    {effectiveDuration && (
                      <span className="text-sm font-normal text-primary">
                        {Math.floor(effectiveDuration / 60) > 0 && `${Math.floor(effectiveDuration / 60)}h `}
                        {effectiveDuration % 60 > 0 && `${effectiveDuration % 60}min`}
                      </span>
                    )}
                  </div>
                </Label>
                {DURATION_OPTIONS.length > 0 ? (
                  <Select 
                    value={manualDuration?.toString() || ''} 
                    onValueChange={handleDurationChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz czas trwania..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-destructive p-2 border border-destructive/30 rounded-md bg-destructive/10">
                    Brak dostępnych opcji czasu trwania - następna rezerwacja zaczyna się za {maxAvailableMinutes} min. 
                    Możesz ręcznie ustawić godzinę zakończenia powyżej.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Dodaj rezerwację
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddReservationDialog;
