import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Plus, X, Check, ChevronDown } from 'lucide-react';
import { format, addDays, subDays, isSameDay, isBefore, startOfDay, isAfter } from 'date-fns';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import { pl } from 'date-fns/locale';
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
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CustomerSearchInput from './CustomerSearchInput';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

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
}

interface AddReservationDialogV2Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  onSuccess: () => void;
  workingHours?: Record<string, WorkingHours | null> | null;
}

const SLOT_INTERVAL = 15;
const MIN_LEAD_TIME_MINUTES = 15;

const AddReservationDialogV2 = ({
  open,
  onClose,
  instanceId,
  onSuccess,
  workingHours = null,
}: AddReservationDialogV2Props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [suggestingSize, setSuggestingSize] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [foundVehicles, setFoundVehicles] = useState<CustomerVehicle[]>([]);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize>('medium');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Date picker
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  // Services dropdown
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [serviceSearchValue, setServiceSearchValue] = useState('');
  
  const slotsScrollRef = useRef<HTMLDivElement>(null);

  // Fetch services and stations on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;
      
      // Fetch services (washing type only for V2)
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name, shortcut, duration_minutes, duration_small, duration_medium, duration_large, price_from, price_small, price_medium, price_large, station_type, is_popular')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .eq('station_type', 'washing')
        .order('sort_order');
      
      if (servicesData) {
        setServices(servicesData);
      }
      
      // Fetch washing stations
      const { data: stationsData } = await supabase
        .from('stations')
        .select('id, name, type')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .eq('type', 'washing')
        .order('sort_order');
      
      if (stationsData) {
        setStations(stationsData);
      }
    };
    
    fetchData();
  }, [open, instanceId]);

  // Fetch availability blocks when date changes
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!instanceId || !selectedDate) return;
      
      const fromDate = format(selectedDate, 'yyyy-MM-dd');
      const toDate = format(addDays(selectedDate, 7), 'yyyy-MM-dd');
      
      const { data } = await supabase.rpc('get_availability_blocks', {
        _instance_id: instanceId,
        _from: fromDate,
        _to: toDate,
      });
      
      if (data) {
        setAvailabilityBlocks(data);
      }
    };
    
    fetchAvailability();
  }, [instanceId, selectedDate]);

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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCustomerName('');
      setPhone('');
      setCarModel('');
      setCarSize('medium');
      setSelectedServices([]);
      setSelectedDate(getNextWorkingDay());
      setSelectedTime(null);
      setSelectedStationId(null);
      setNotes('');
      setFoundVehicles([]);
      setFoundCustomers([]);
      setSelectedCustomerId(null);
      setShowPhoneDropdown(false);
      setShowCustomerDropdown(false);
    }
  }, [open, getNextWorkingDay]);

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

  // Get available time slots for the selected date
  const getAvailableSlots = (): TimeSlot[] => {
    if (!workingHours || selectedServices.length === 0 || stations.length === 0) {
      return [];
    }
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayName = format(selectedDate, 'EEEE').toLowerCase();
    const dayHours = workingHours[dayName];
    
    if (!dayHours) return [];
    
    const [openH, openM] = dayHours.open.split(':').map(Number);
    const [closeH, closeM] = dayHours.close.split(':').map(Number);
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
    
    for (let time = minStartTime; time + totalDurationMinutes <= closeMinutes; time += SLOT_INTERVAL) {
      const timeStr = `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
      const endTime = time + totalDurationMinutes;
      
      const availableStationIds = stations.filter(station => {
        const stationBlocks = dayBlocks.filter(b => b.station_id === station.id);
        return !stationBlocks.some(block => {
          const blockStart = parseInt(block.start_time.split(':')[0]) * 60 + parseInt(block.start_time.split(':')[1]);
          const blockEnd = parseInt(block.end_time.split(':')[0]) * 60 + parseInt(block.end_time.split(':')[1]);
          return time < blockEnd && endTime > blockStart;
        });
      }).map(s => s.id);
      
      if (availableStationIds.length > 0) {
        slots.push({ time: timeStr, availableStationIds });
      }
    }
    
    return slots;
  };

  const availableSlots = getAvailableSlots();

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      }
      return [...prev, serviceId];
    });
    // Reset time selection when services change
    setSelectedTime(null);
    setSelectedStationId(null);
  };

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
    
    const timer = setTimeout(() => {
      searchByPhone(phone);
    }, 300);
    return () => clearTimeout(timer);
  }, [phone, searchByPhone, selectedCustomerId]);

  const selectVehicle = async (vehicle: CustomerVehicle) => {
    setPhone(vehicle.phone);
    setCarModel(vehicle.model);
    setShowPhoneDropdown(false);
    
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
    
    if (vehicle.model && vehicle.model.length >= 3) {
      suggestCarSize(vehicle.model);
    }
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0) {
      toast.error(t('addReservation.selectAtLeastOneService'));
      return;
    }
    
    if (!selectedTime || !selectedStationId) {
      toast.error(t('addReservation.selectTimeSlot'));
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

      // Calculate end time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + totalDurationMinutes;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

      const reservationData: {
        instance_id: string;
        station_id: string;
        reservation_date: string;
        start_time: string;
        end_time: string;
        customer_name: string;
        customer_phone: string;
        vehicle_plate: string;
        car_size: CarSize | null;
        notes: string | null;
        service_id: string;
        service_ids: string[];
        confirmation_code: string;
        status: 'confirmed' | 'pending';
      } = {
        instance_id: instanceId,
        station_id: selectedStationId,
        reservation_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedTime,
        end_time: endTime,
        customer_name: customerName || t('addReservation.defaultCustomer'),
        customer_phone: phone || '',
        vehicle_plate: carModel || '',
        car_size: carSize || null,
        notes: notes.trim() || null,
        service_id: selectedServices[0],
        service_ids: selectedServices,
        confirmation_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        status: 'confirmed',
      };

      const { error: reservationError } = await supabase
        .from('reservations')
        .insert([reservationData]);

      if (reservationError) throw reservationError;

      toast.success(t('addReservation.reservationCreated'));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving reservation:', error);
      toast.error(t('addReservation.reservationError'));
    } finally {
      setLoading(false);
    }
  };

  // Get popular services with shortcuts for quick selection
  const shortcutServices = services.filter(s => s.shortcut && s.is_popular).slice(0, 6);
  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(serviceSearchValue.toLowerCase()) ||
    (s.shortcut && s.shortcut.toLowerCase().includes(serviceSearchValue.toLowerCase()))
  );

  const canGoPrev = !isBefore(subDays(selectedDate, 1), startOfDay(new Date()));

  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0 [&_input]:focus:ring-ring [&_input]:focus:ring-offset-0 [&_textarea]:focus:ring-ring [&_textarea]:focus:ring-offset-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Fixed Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{t('addReservation.title')}</DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t('addReservation.customerNameAlias')}
              </Label>
              <CustomerSearchInput
                instanceId={instanceId}
                value={customerName}
                onChange={(val) => {
                  setCustomerName(val);
                  setSelectedCustomerId(null);
                }}
                onSelectCustomer={(customer) => {
                  setCustomerName(customer.name);
                  setPhone(customer.phone);
                  setSelectedCustomerId(customer.id);
                }}
                placeholder={t('addReservation.customerNameAlias')}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">
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
                  autoComplete="off"
                />
                {searchingCustomer && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {showPhoneDropdown && foundVehicles.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden bg-popover shadow-lg z-[9999]">
                  {foundVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex flex-col border-b border-border last:border-0"
                      onClick={() => selectVehicle(vehicle)}
                    >
                      <div className="font-medium text-sm">
                        {vehicle.customer_name || vehicle.phone}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {vehicle.phone}{vehicle.model && ` • ${vehicle.model}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Car Model + Size */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
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
                        if ('size' in val) {
                          if (val.size === 'S') setCarSize('small');
                          else if (val.size === 'M') setCarSize('medium');
                          else if (val.size === 'L') setCarSize('large');
                        }
                      }
                    }}
                  />
                  {suggestingSize && (
                    <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-pulse text-primary" />
                  )}
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
            </div>

            {/* Services shortcuts row */}
            <div className="space-y-2">
              <Label>{t('addReservation.services')}</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {shortcutServices.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service.id)}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-full border transition-all",
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-card border-border hover:border-primary/50"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                      {service.shortcut || service.name}
                    </button>
                  );
                })}
                
                {/* More services button */}
                <Popover open={servicesDropdownOpen} onOpenChange={setServicesDropdownOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder={t('addReservation.searchServices')} 
                        value={serviceSearchValue}
                        onValueChange={setServiceSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>{t('common.noResults')}</CommandEmpty>
                        <CommandGroup>
                          {filteredServices.map((service) => {
                            const isSelected = selectedServices.includes(service.id);
                            return (
                              <CommandItem
                                key={service.id}
                                onSelect={() => {
                                  toggleService(service.id);
                                }}
                                className="flex items-center gap-2"
                              >
                                <div className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center",
                                  isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                                )}>
                                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                </div>
                                <span>{service.name}</span>
                                {service.shortcut && (
                                  <span className="text-xs text-muted-foreground">({service.shortcut})</span>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Selected services (if any not in shortcuts) */}
              {selectedServices.filter(id => !shortcutServices.find(s => s.id === id)).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedServices
                    .filter(id => !shortcutServices.find(s => s.id === id))
                    .map(id => {
                      const service = services.find(s => s.id === id);
                      if (!service) return null;
                      return (
                        <span 
                          key={id} 
                          className="px-2 py-1 text-xs rounded-full bg-primary text-primary-foreground flex items-center gap-1"
                        >
                          {service.shortcut || service.name}
                          <button 
                            type="button"
                            onClick={() => toggleService(id)}
                            className="hover:bg-primary-foreground/20 rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                </div>
              )}
              
              {totalDurationMinutes > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('addReservation.totalDuration')}: {totalDurationMinutes} min
                </p>
              )}
            </div>

            {/* Date navigation - no label, obvious */}
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
                      className="text-base font-medium hover:text-primary transition-colors"
                    >
                      {format(selectedDate, 'EEEE, d MMM', { locale: pl })}
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
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
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

            {/* Time slots */}
            <div className="space-y-2">
              <Label>{t('addReservation.availableSlots')}</Label>
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
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => handleSelectSlot(slot)}
                          className={cn(
                            "flex-shrink-0 py-3 px-5 rounded-2xl text-base font-medium transition-all duration-200 min-w-[80px]",
                            isSelected 
                              ? "bg-primary text-primary-foreground shadow-lg" 
                              : "bg-card border-2 border-border hover:border-primary/50"
                          )}
                        >
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
            </div>

            {/* Notes - collapsed by default */}
            <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={cn("w-4 h-4 transition-transform", notesOpen && "rotate-180")} />
                  {t('addReservation.notes')}
                  {notes && !notesOpen && <span className="text-xs">({t('common.filled')})</span>}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t('addReservation.notesPlaceholder')}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Fixed Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedServices.length === 0 || !selectedTime} className="flex-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('addReservation.addReservation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddReservationDialogV2;
