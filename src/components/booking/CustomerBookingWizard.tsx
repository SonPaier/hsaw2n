import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, addDays, parseISO, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isBefore, startOfDay, isToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, ArrowLeft, Instagram, Loader2, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import SendSmsDialog from '@/components/admin/SendSmsDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Checkbox } from '@/components/ui/checkbox';
import { useWebOTP } from '@/hooks/useWebOTP';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useInstanceFeatures } from '@/hooks/useInstanceFeatures';
import UpsellSuggestion from './UpsellSuggestion';
import IOSInstallPrompt from '@/components/pwa/IOSInstallPrompt';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  duration_small: number | null;
  duration_medium: number | null;
  duration_large: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  requires_size: boolean | null;
  station_type: string | null;
}
interface Station {
  id: string;
  name: string;
  type: string;
}
interface TimeSlot {
  time: string;
  availableStationIds: string[];
}
interface AvailableDay {
  date: Date;
  slots: TimeSlot[];
}
interface Instance {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  working_hours: Record<string, {
    open: string;
    close: string;
  } | null> | null;
  social_facebook: string | null;
  social_instagram: string | null;
  booking_days_ahead: number;
  auto_confirm_reservations: boolean | null;
}
interface AvailabilityBlock {
  block_date: string;
  start_time: string;
  end_time: string;
  station_id: string;
}
interface ExistingReservation {
  id: string;
  confirmation_code: string;
  service_id: string;
  reservation_date: string;
  start_time: string;
  station_id: string | null;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  car_size: string | null;
  customer_notes: string | null;
  instance_id: string;
}
export interface CustomerBookingWizardProps {
  onLayoutChange?: (hideHeader: boolean, hideFooter: boolean) => void;
  instanceSubdomain?: string;
}
const POPULAR_KEYWORDS = ['mycie', 'pranie', 'detailing'];
const MIN_LEAD_TIME_MINUTES = 30;
const SLOT_INTERVAL = 15;
type Step = 'phone' | 'service' | 'datetime' | 'summary' | 'success';
type TimeOfDay = 'morning' | 'afternoon' | 'evening';

// OTP Input component with autofocus refresh for triggering SMS autofill
function OTPInputWithAutoFocus({
  value,
  onChange,
  onComplete,
  smsSent,
  isVerifying
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  smsSent: boolean;
  isVerifying: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!smsSent || isVerifying) return;
    const focusInput = () => {
      const input = containerRef.current?.querySelector('input');
      if (input && document.activeElement !== input) {
        input.focus();
      }
    };
    focusInput();
    const interval = setInterval(focusInput, 500);
    const timeout = setTimeout(() => clearInterval(interval), 10000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [smsSent, isVerifying]);
  return <div ref={containerRef} className="flex justify-center mb-4">
      <InputOTP maxLength={4} value={value} onChange={onChange} onComplete={onComplete} autoComplete="one-time-code" inputMode="numeric" className="gap-3" autoFocus>
        <InputOTPGroup className="gap-3">
          <InputOTPSlot index={0} className="h-14 w-14 text-2xl font-bold border-2" />
          <InputOTPSlot index={1} className="h-14 w-14 text-2xl font-bold border-2" />
          <InputOTPSlot index={2} className="h-14 w-14 text-2xl font-bold border-2" />
          <InputOTPSlot index={3} className="h-14 w-14 text-2xl font-bold border-2" />
        </InputOTPGroup>
      </InputOTP>
    </div>;
}

// Service description component with "see more" functionality
function ServiceDescription({ description, serviceId }: { description: string; serviceId: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  
  // Check if description is long (roughly more than 3 lines = ~150 chars)
  const isLong = description.length > 120;
  
  if (!isLong || expanded) {
    return <p className="text-muted-foreground text-xs mt-0.5">{description}</p>;
  }
  
  return (
    <div className="mt-0.5">
      <p className="text-muted-foreground text-xs line-clamp-3">{description}</p>
      <button 
        type="button"
        onClick={(e) => { 
          e.stopPropagation(); 
          setExpanded(true); 
        }}
        className="text-primary text-xs underline hover:no-underline mt-0.5"
      >
        {t('common.show')} więcej
      </button>
    </div>
  );
}
export default function CustomerBookingWizard({
  onLayoutChange,
  instanceSubdomain
}: CustomerBookingWizardProps) {
  const {
    t
  } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Edit mode from navigation state
  const editMode = location.state?.editMode === true;
  const existingReservation = location.state?.existingReservation as ExistingReservation | undefined;

  // Start from service step if in edit mode (allow editing service), otherwise from phone
  const [step, setStep] = useState<Step>(editMode ? 'service' : 'phone');
  const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>('forward');
  const [instance, setInstance] = useState<Instance | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAddons, setShowAddons] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Navigation helpers with animation direction
  const goToStep = (newStep: Step, direction: 'forward' | 'back' = 'forward') => {
    setSlideDirection(direction);
    setStep(newStep);
  };

  // Feature flags
  const {
    hasFeature
  } = useInstanceFeatures(instance?.id ?? null);

  // Selected values
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [carSize, setCarSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Date/time carousel state
  const [dayScrollIndex, setDayScrollIndex] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [slotScrollIndex, setSlotScrollIndex] = useState(0);

  // Calendar month state (for Booksy-style calendar)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const slotsScrollRef = useRef<HTMLDivElement>(null);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [nipNumber, setNipNumber] = useState('');
  const [historicalCarModels, setHistoricalCarModels] = useState<{
    model: string;
    count: number;
  }[]>([]);
  const [showNotes, setShowNotes] = useState(false);

  // Verified customer state
  const [isVerifiedCustomer, setIsVerifiedCustomer] = useState(false);
  const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);

  // Verification
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsSentTimestamp, setSmsSentTimestamp] = useState<number | null>(null);
  const [smsError, setSmsError] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);

  // Success
  const [confirmationData, setConfirmationData] = useState<{
    confirmationCode: string;
    date: string;
    time: string;
    serviceName: string;
    status: 'confirmed' | 'pending';
    carModel?: string;
    price?: string;
  } | null>(null);
  const [socialLinks, setSocialLinks] = useState<{
    facebook: string | null;
    instagram: string | null;
  }>({
    facebook: null,
    instagram: null
  });
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showRodoDialog, setShowRodoDialog] = useState(false);
  const isMobile = useIsMobile();

  // WebOTP hook for automatic SMS code reading on Android/Chrome
  const handleWebOTPCode = useCallback((code: string) => {
    setVerificationCode(code);
  }, []);
  useWebOTP({
    onCodeReceived: handleWebOTPCode,
    enabled: smsSent && !isVerifying,
    timeoutMs: 60000
  });

  // Notify parent about layout changes - hide header for all steps except phone, footer always visible
  useEffect(() => {
    if (onLayoutChange) {
      onLayoutChange(step !== 'phone', false);
    }
  }, [step, onLayoutChange]);

  // Load customer data from localStorage on mount
  useEffect(() => {
    const savedCustomer = localStorage.getItem('bookingCustomerData');
    if (savedCustomer) {
      try {
        const data = JSON.parse(savedCustomer);
        if (data.phone) setCustomerPhone(data.phone);
        if (data.name) setCustomerName(data.name);
        if (data.carModel) setCarModel(data.carModel);
      } catch (e) {
        console.log('Failed to parse saved customer data');
      }
    }
  }, []);

  // Check if customer is verified and fetch vehicles when phone changes - using edge function for security
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      if (!instance || customerPhone.length < 9) {
        setIsVerifiedCustomer(false);
        setHistoricalCarModels([]);
        return;
      }
      
      setIsCheckingCustomer(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-customer-info', {
          body: { phone: customerPhone, instanceId: instance.id }
        });
        
        if (error) {
          console.error('Error fetching customer info:', error);
          setIsVerifiedCustomer(false);
          setHistoricalCarModels([]);
          return;
        }
        
        setIsVerifiedCustomer(data.isVerified === true);
        if (data.name && !customerName) {
          setCustomerName(data.name);
        }
        
        // Set vehicles from response
        if (data.vehicles && data.vehicles.length > 0) {
          const sortedModels = data.vehicles.map((v: { model: string; usage_count: number }) => ({
            model: v.model,
            count: v.usage_count
          }));
          setHistoricalCarModels(sortedModels);
          
          // Auto-fill with most frequent model if carModel is empty
          if (!carModel && sortedModels.length > 0) {
            setCarModel(sortedModels[0].model);
          }
        } else {
          setHistoricalCarModels([]);
        }
      } catch (e) {
        console.error('Error in fetchCustomerInfo:', e);
        setIsVerifiedCustomer(false);
        setHistoricalCarModels([]);
      } finally {
        setIsCheckingCustomer(false);
      }
    };
    
    const timeoutId = setTimeout(fetchCustomerInfo, 500);
    return () => clearTimeout(timeoutId);
  }, [customerPhone, instance]);

  // Vehicles are now fetched in the combined fetchCustomerInfo effect above

  // Car size is set directly from CarSearchAutocomplete selection
  // For custom input (not from list), default to 'medium'

  // Auto-select first available slot when entering datetime step or when date changes
  // Skip in edit mode - we want to preserve the existing date/time selection
  useEffect(() => {
    if (step === 'datetime' && selectedService && instance?.working_hours && stations.length > 0) {
      // In edit mode, skip auto-selection if we already have valid selections
      if (editMode && selectedDate && selectedTime && selectedStationId) {
        return;
      }

      // Recalculate available days inline to get slots
      const serviceDuration = selectedService.duration_minutes || 60;
      const compatibleStations = stations.filter(s => {
        if (!selectedService.station_type) return true;
        return s.type === selectedService.station_type || s.type === 'universal';
      });
      const today = new Date();
      const daysAhead = instance.booking_days_ahead ?? 90;

      // Find first available slot across all days
      let foundFirstSlot = false;
      for (let i = 0; i < daysAhead && !foundFirstSlot; i++) {
        const date = addDays(today, i);
        const dayName = format(date, 'EEEE').toLowerCase();
        const workingHours = instance.working_hours[dayName];
        if (!workingHours) continue;
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayBlocks = availabilityBlocks.filter(b => b.block_date === dateStr);
        const [openH, openM] = workingHours.open.split(':').map(Number);
        const [closeH, closeM] = workingHours.close.split(':').map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;
        let minStartTime = openMinutes;
        if (i === 0) {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes() + MIN_LEAD_TIME_MINUTES;
          minStartTime = Math.max(openMinutes, Math.ceil(nowMinutes / SLOT_INTERVAL) * SLOT_INTERVAL);
        }
        for (let time = minStartTime; time + serviceDuration <= closeMinutes; time += SLOT_INTERVAL) {
          const timeStr = `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
          const endTime = time + serviceDuration;
          const availableStation = compatibleStations.find(station => {
            const stationBlocks = dayBlocks.filter(b => b.station_id === station.id);
            return !stationBlocks.some(block => {
              const blockStart = parseInt(block.start_time.split(':')[0]) * 60 + parseInt(block.start_time.split(':')[1]);
              const blockEnd = parseInt(block.end_time.split(':')[0]) * 60 + parseInt(block.end_time.split(':')[1]);
              return time < blockEnd && endTime > blockStart;
            });
          });
          if (availableStation) {
            // Found first available slot - auto-select it
            setSelectedDate(date);
            setSelectedTime(timeStr);
            setSelectedStationId(availableStation.id);
            setCurrentMonth(startOfMonth(date));
            foundFirstSlot = true;
            break;
          }
        }
      }

      // Set time of day based on selected time
      if (selectedDate) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const dayName = format(selectedDate, 'EEEE').toLowerCase();
        const workingHours = instance.working_hours[dayName];
        if (workingHours) {
          const dayBlocks = availabilityBlocks.filter(b => b.block_date === dateStr);
          const [openH, openM] = workingHours.open.split(':').map(Number);
          const [closeH, closeM] = workingHours.close.split(':').map(Number);
          const openMinutes = openH * 60 + openM;
          const closeMinutes = closeH * 60 + closeM;
          const slots: {
            time: string;
          }[] = [];
          for (let time = openMinutes; time + serviceDuration <= closeMinutes; time += 15) {
            const timeStr = `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
            const endTime = time + serviceDuration;
            const hasAvailableStation = compatibleStations.some(station => {
              const stationBlocks = dayBlocks.filter(b => b.station_id === station.id);
              return !stationBlocks.some(block => {
                const blockStart = parseInt(block.start_time.split(':')[0]) * 60 + parseInt(block.start_time.split(':')[1]);
                const blockEnd = parseInt(block.end_time.split(':')[0]) * 60 + parseInt(block.end_time.split(':')[1]);
                return time < blockEnd && endTime > blockStart;
              });
            });
            if (hasAvailableStation) {
              slots.push({
                time: timeStr
              });
            }
          }
          const morning = slots.filter(s => parseInt(s.time.split(':')[0]) < 12).length;
          const afternoon = slots.filter(s => {
            const h = parseInt(s.time.split(':')[0]);
            return h >= 12 && h < 17;
          }).length;
          const evening = slots.filter(s => parseInt(s.time.split(':')[0]) >= 17).length;
          if (morning > 0) setTimeOfDay('morning');else if (afternoon > 0) setTimeOfDay('afternoon');else if (evening > 0) setTimeOfDay('evening');
          setSlotScrollIndex(0);
        }
      }
    }
  }, [step, selectedService, instance, stations, availabilityBlocks]);
  const saveCustomerToLocalStorage = () => {
    localStorage.setItem('bookingCustomerData', JSON.stringify({
      phone: customerPhone,
      name: customerName,
      carModel: carModel
    }));
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let instanceData;

      // If subdomain is provided, fetch instance by subdomain
      if (instanceSubdomain) {
        const {
          data
        } = await supabase.from('instances').select('*').eq('subdomain', instanceSubdomain).eq('active', true).maybeSingle();
        instanceData = data;

        // Fallback: try by slug if subdomain not found
        if (!instanceData) {
          const {
            data: slugData
          } = await supabase.from('instances').select('*').eq('slug', instanceSubdomain).eq('active', true).maybeSingle();
          instanceData = slugData;
        }
      } else {
        // Default: get first active instance (for dev/local)
        const {
          data
        } = await supabase.from('instances').select('*').eq('active', true).limit(1).maybeSingle();
        instanceData = data;
      }
      if (instanceData) {
        const parsedInstance: Instance = {
          id: instanceData.id,
          name: instanceData.name,
          phone: instanceData.phone,
          address: instanceData.address,
          working_hours: instanceData.working_hours as Record<string, {
            open: string;
            close: string;
          } | null> | null,
          social_facebook: instanceData.social_facebook,
          social_instagram: instanceData.social_instagram,
          booking_days_ahead: instanceData.booking_days_ahead ?? 90,
          auto_confirm_reservations: instanceData.auto_confirm_reservations ?? false
        };
        setInstance(parsedInstance);
        const {
          data: servicesData
        } = await supabase.from('unified_services').select('*').eq('instance_id', instanceData.id).eq('active', true).eq('service_type', 'reservation').order('sort_order') as unknown as { data: Service[] | null };
        setServices(servicesData || []);
        const {
          data: stationsData
        } = await supabase.from('stations').select('*').eq('instance_id', instanceData.id).eq('active', true).order('sort_order');
        setStations(stationsData as Station[] || []);
        const today = new Date();
        const daysAhead = instanceData.booking_days_ahead ?? 90;
        const endDate = addDays(today, daysAhead);
        const {
          data: blocksData
        } = await supabase.rpc('get_availability_blocks', {
          _instance_id: instanceData.id,
          _from: format(today, 'yyyy-MM-dd'),
          _to: format(endDate, 'yyyy-MM-dd')
        });
        setAvailabilityBlocks(blocksData as AvailabilityBlock[] || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [instanceSubdomain]);

  // Initialize from existingReservation when in edit mode
  useEffect(() => {
    if (editMode && existingReservation && services.length > 0 && !loading) {
      // Set customer data
      setCustomerName(existingReservation.customer_name || '');
      setCustomerPhone(existingReservation.customer_phone || '');
      setCarModel(existingReservation.vehicle_plate || '');
      setCustomerNotes(existingReservation.customer_notes || '');
      if (existingReservation.car_size) {
        setCarSize(existingReservation.car_size as 'small' | 'medium' | 'large');
      }

      // Set service
      const service = services.find(s => s.id === existingReservation.service_id);
      if (service) {
        setSelectedService(service);
      }

      // Set date and time
      if (existingReservation.reservation_date) {
        const date = parseISO(existingReservation.reservation_date);
        setSelectedDate(date);
        setCurrentMonth(startOfMonth(date));
      }
      if (existingReservation.start_time) {
        setSelectedTime(existingReservation.start_time.slice(0, 5));
      }
      if (existingReservation.station_id) {
        setSelectedStationId(existingReservation.station_id);
      }

      // Customer is already verified in edit mode (they have the link)
      setIsVerifiedCustomer(true);
    }
  }, [editMode, existingReservation, services, loading]);
  const popularServices = services.filter(s => POPULAR_KEYWORDS.some(k => s.name.toLowerCase().includes(k))).slice(0, 3);
  const otherServices = services.filter(s => !popularServices.includes(s));
  const getServicePrice = (service: Service): number => {
    if (service.requires_size) {
      if (carSize === 'small') return service.price_small || service.price_from || 0;
      if (carSize === 'large') return service.price_large || service.price_from || 0;
      return service.price_medium || service.price_from || 0;
    }
    return service.price_from || 0;
  };

  // Get service duration based on car size
  const getServiceDuration = (service: Service): number => {
    if (service.requires_size) {
      if (carSize === 'small') return service.duration_small || service.duration_minutes || 60;
      if (carSize === 'large') return service.duration_large || service.duration_minutes || 60;
      return service.duration_medium || service.duration_minutes || 60;
    }
    return service.duration_minutes || 60;
  };

  // Calculate total duration including addons
  const getTotalDuration = (): number => {
    let total = selectedService ? getServiceDuration(selectedService) : 60;
    for (const addonId of selectedAddons) {
      const addon = services.find(s => s.id === addonId);
      if (addon) {
        total += getServiceDuration(addon);
      }
    }
    return total;
  };

  // Calculate available time slots
  const getAvailableDays = (): AvailableDay[] => {
    if (!selectedService || !instance?.working_hours || stations.length === 0) return [];
    const days: AvailableDay[] = [];
    const today = new Date();
    const serviceDuration = getTotalDuration();
    const compatibleStations = stations.filter(s => {
      if (!selectedService.station_type) return true;
      return s.type === selectedService.station_type || s.type === 'universal';
    });
    const daysAhead = instance.booking_days_ahead ?? 90;

    // In edit mode, filter out blocks that belong to the currently edited reservation
    const filteredBlocks = editMode && existingReservation ? availabilityBlocks.filter(block => {
      const isOwnBlock = block.block_date === existingReservation.reservation_date && block.start_time === existingReservation.start_time && block.station_id === existingReservation.station_id;
      return !isOwnBlock;
    }) : availabilityBlocks;
    for (let i = 0; i < daysAhead; i++) {
      const date = addDays(today, i);
      const dayName = format(date, 'EEEE').toLowerCase();
      const workingHours = instance.working_hours[dayName];
      if (!workingHours) continue;
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayBlocks = filteredBlocks.filter(b => b.block_date === dateStr);
      const [openH, openM] = workingHours.open.split(':').map(Number);
      const [closeH, closeM] = workingHours.close.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      let minStartTime = openMinutes;
      if (i === 0) {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes() + MIN_LEAD_TIME_MINUTES;
        minStartTime = Math.max(openMinutes, Math.ceil(nowMinutes / SLOT_INTERVAL) * SLOT_INTERVAL);
      }
      const slotMap = new Map<string, string[]>();
      for (let time = minStartTime; time + serviceDuration <= closeMinutes; time += SLOT_INTERVAL) {
        const timeStr = `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
        const endTime = time + serviceDuration;
        const availableStations: string[] = [];
        for (const station of compatibleStations) {
          const stationBlocks = dayBlocks.filter(b => b.station_id === station.id);
          const hasConflict = stationBlocks.some(block => {
            const blockStart = parseInt(block.start_time.split(':')[0]) * 60 + parseInt(block.start_time.split(':')[1]);
            const blockEnd = parseInt(block.end_time.split(':')[0]) * 60 + parseInt(block.end_time.split(':')[1]);
            return time < blockEnd && endTime > blockStart;
          });
          if (!hasConflict) {
            availableStations.push(station.id);
          }
        }
        if (availableStations.length > 0) {
          slotMap.set(timeStr, availableStations);
        }
      }
      const slots: TimeSlot[] = Array.from(slotMap.entries()).map(([time, availableStationIds]) => ({
        time,
        availableStationIds
      })).sort((a, b) => a.time.localeCompare(b.time));
      if (slots.length > 0) {
        days.push({
          date,
          slots
        });
      }
    }
    return days;
  };
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setStep('datetime');
    // Reset selection when service changes - keep today as default
    setSelectedDate(new Date());
    setSelectedTime(null);
    setSelectedStationId(null);
    setDayScrollIndex(0);
    setSlotScrollIndex(0);
  };
  const handleSelectTime = (slot: TimeSlot) => {
    setSelectedTime(slot.time);
    setSelectedStationId(slot.availableStationIds[0]);
  };
  const handleConfirmDateTime = () => {
    if (selectedDate && selectedTime && selectedStationId) {
      goToStep('summary', 'forward');
    }
  };
  const toggleAddon = (serviceId: string) => {
    setSelectedAddons(prev => prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]);
  };
  const getTotalPrice = (): number => {
    let total = selectedService ? getServicePrice(selectedService) : 0;
    for (const addonId of selectedAddons) {
      const addon = services.find(s => s.id === addonId);
      if (addon) {
        total += getServicePrice(addon);
      }
    }
    return total;
  };
  const handleDirectReservation = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: t('errors.validationError'),
        description: t('errors.requiredField'),
        variant: 'destructive'
      });
      return;
    }
    if (!selectedService || !selectedDate || !selectedTime || !instance) {
      toast({
        title: t('common.error'),
        description: t('errors.requiredField'),
        variant: 'destructive'
      });
      return;
    }
    setIsSendingSms(true);
    try {
      const response = await supabase.functions.invoke('create-reservation-direct', {
        body: {
          instanceId: instance.id,
          phone: customerPhone,
          reservationData: {
            serviceId: selectedService.id,
            addons: selectedAddons,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            carSize: selectedService.requires_size ? carSize : undefined,
            stationId: selectedStationId,
            vehiclePlate: carModel.trim() || 'BRAK',
            notes: customerNotes.trim() || null
          }
        }
      });
      if (response.error) {
        throw new Error(response.error.message);
      }
      const data = response.data;
      if (!data.success) {
        if (data.requiresVerification) {
          setIsVerifiedCustomer(false);
          handleSendSms();
          return;
        }
        toast({
          title: t('common.error'),
          description: data.error || t('errors.generic'),
          variant: 'destructive'
        });
        return;
      }
      saveCustomerToLocalStorage();
      setConfirmationData({
        confirmationCode: data.reservation.confirmationCode,
        date: data.reservation.date,
        time: data.reservation.time,
        serviceName: data.reservation.serviceName,
        status: data.reservation.status || 'confirmed',
        carModel: carModel || undefined,
        price: `${getTotalPrice()} ${t('common.currency')}`
      });
      setSocialLinks({
        facebook: data.instance?.social_facebook || null,
        instagram: data.instance?.social_instagram || null
      });
      goToStep('success', 'forward');
    } catch (error) {
      console.error('Error creating direct reservation:', error);
      toast({
        title: t('common.error'),
        description: t('errors.generic'),
        variant: 'destructive'
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  // Handle update reservation in edit mode - creates a change request via SECURITY DEFINER function
  const handleUpdateReservation = async () => {
    if (!existingReservation || !selectedService || !selectedDate || !selectedTime || !instance) {
      toast({
        title: t('common.error'),
        description: t('errors.requiredField'),
        variant: 'destructive'
      });
      return;
    }
    setIsSaving(true);
    try {
      const newReservationDate = format(selectedDate, 'yyyy-MM-dd');

      // Use SECURITY DEFINER function to create change request (bypasses RLS)
      const { data: changeResult, error: changeError } = await supabase.rpc(
        'request_reservation_change_by_code',
        {
          _original_confirmation_code: existingReservation.confirmation_code,
          _new_reservation_date: newReservationDate,
          _new_start_time: selectedTime,
          _new_service_id: selectedService.id,
          _new_station_id: selectedStationId
        }
      );

      if (changeError) {
        // Handle specific error messages from function
        const errMsg = changeError.message || '';
        if (errMsg.includes('ALREADY_HAS_PENDING_CHANGE')) {
          toast({
            title: t('common.error'),
            description: t('myReservation.alreadyHasPendingChange'),
            variant: 'destructive'
          });
        } else if (errMsg.includes('RESERVATION_NOT_FOUND')) {
          toast({
            title: t('common.error'),
            description: t('errors.notFound'),
            variant: 'destructive'
          });
        } else if (errMsg.includes('RESERVATION_NOT_EDITABLE')) {
          toast({
            title: t('common.error'),
            description: t('myReservation.cannotEdit'),
            variant: 'destructive'
          });
        } else if (errMsg.includes('EDIT_CUTOFF_PASSED')) {
          toast({
            title: t('common.error'),
            description: t('myReservation.editCutoffPassed'),
            variant: 'destructive'
          });
        } else {
          throw changeError;
        }
        setIsSaving(false);
        return;
      }

      // changeResult is an array with { id, confirmation_code }
      const newConfirmationCode = changeResult?.[0]?.confirmation_code;

      // Send push notification to admin
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            instanceId: existingReservation.instance_id,
            title: `🔄 ${t('myReservation.notifications.changeRequestPush', {
              name: existingReservation.customer_name
            })}`,
            body: `${selectedService.name} - ${newReservationDate} o ${selectedTime}`,
            url: `/admin?reservationCode=${newConfirmationCode || existingReservation.confirmation_code}`
          }
        });
      } catch (pushError) {
        console.error('Push notification error:', pushError);
      }
      toast({
        title: t('myReservation.changeRequestSent')
      });

      // Redirect back to original reservation page (it still shows the original)
      navigate(`/res?code=${existingReservation.confirmation_code}`);
    } catch (error) {
      console.error('Error creating change request:', error);
      // Report unexpected backend errors to Sentry
      const { captureBackendError } = await import('@/lib/sentry');
      captureBackendError('handleUpdateReservation', {
        code: (error as { code?: string })?.code,
        message: (error as Error)?.message,
        details: error
      }, {
        confirmation_code: existingReservation.confirmation_code,
        instance_id: existingReservation.instance_id,
        service_id: selectedService.id,
        date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
        time: selectedTime
      });
      toast({
        title: t('common.error'),
        description: t('errors.generic'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };
  const handleSendSms = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: t('errors.validationError'),
        description: t('errors.requiredField'),
        variant: 'destructive'
      });
      return;
    }
    if (!selectedService || !selectedDate || !selectedTime || !instance) {
      toast({
        title: t('common.error'),
        description: t('errors.requiredField'),
        variant: 'destructive'
      });
      return;
    }
    setIsSendingSms(true);
    setSmsError(false);
    setShowResendButton(false);
    try {
      const response = await supabase.functions.invoke('send-sms-code', {
        body: {
          phone: customerPhone,
          instanceId: instance.id,
          reservationData: {
            serviceId: selectedService.id,
            addons: selectedAddons,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            carSize: selectedService.requires_size ? carSize : undefined,
            stationId: selectedStationId,
            vehiclePlate: carModel.trim() || 'BRAK',
            notes: customerNotes.trim() || null
          }
        }
      });
      if (response.error) {
        throw new Error(response.error.message);
      }
      toast({
        title: t('booking.codeSent'),
        description: t('booking.enterCode')
      });
      setSmsSent(true);
      setSmsSentTimestamp(Date.now());
      // Show resend button after 10 seconds
      setTimeout(() => {
        setShowResendButton(true);
      }, 10000);
    } catch (error) {
      console.error('Error sending SMS:', error);
      setSmsError(true);
      setShowResendButton(true);
      toast({
        title: t('common.error'),
        description: t('booking.smsSendError'),
        variant: 'destructive'
      });
    } finally {
      setIsSendingSms(false);
    }
  };
  const handleVerifyCode = useCallback(async (codeToVerify?: string) => {
    const code = codeToVerify || verificationCode;
    if (code.length !== 4) {
      toast({
        title: t('booking.invalidCode'),
        description: t('booking.enterCode'),
        variant: 'destructive'
      });
      return;
    }
    if (!instance) return;
    setIsVerifying(true);
    try {
      const response = await supabase.functions.invoke('verify-sms-code', {
        body: {
          phone: customerPhone,
          code: code,
          instanceId: instance.id
        }
      });
      if (response.error) {
        throw new Error(response.error.message);
      }
      const data = response.data;
      if (!data.success) {
        toast({
          title: t('booking.invalidCode'),
          description: data.error || t('booking.verificationError'),
          variant: 'destructive'
        });
        return;
      }
      saveCustomerToLocalStorage();
      setConfirmationData({
        confirmationCode: data.reservation.confirmationCode,
        date: data.reservation.date,
        time: data.reservation.time,
        serviceName: data.reservation.serviceName,
        status: data.reservation.status || 'confirmed',
        carModel: carModel || undefined,
        price: `${getTotalPrice()} ${t('common.currency')}`
      });
      setSocialLinks({
        facebook: data.instance?.social_facebook || null,
        instagram: data.instance?.social_instagram || null
      });
      goToStep('success', 'forward');
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: t('booking.verificationError'),
        description: t('booking.verificationError'),
        variant: 'destructive'
      });
    } finally {
      setIsVerifying(false);
    }
  }, [verificationCode, instance, customerPhone, saveCustomerToLocalStorage]);
  const handleReservationClick = () => {
    if (isVerifiedCustomer) {
      handleDirectReservation();
    } else {
      handleSendSms();
    }
  };
  const availableDays = getAvailableDays();
  const addonServices = services.filter(s => s.id !== selectedService?.id);

  // Filter slots by time of day
  const filterSlotsByTimeOfDay = (slots: TimeSlot[], tod: TimeOfDay): TimeSlot[] => {
    return slots.filter(slot => {
      const [hours] = slot.time.split(':').map(Number);
      if (tod === 'morning') return hours < 12;
      if (tod === 'afternoon') return hours >= 12 && hours < 17;
      return hours >= 17;
    });
  };

  // Get slots count for each time of day
  const getSlotsCountByTimeOfDay = (slots: TimeSlot[]): {
    morning: number;
    afternoon: number;
    evening: number;
  } => {
    return {
      morning: slots.filter(s => parseInt(s.time.split(':')[0]) < 12).length,
      afternoon: slots.filter(s => {
        const h = parseInt(s.time.split(':')[0]);
        return h >= 12 && h < 17;
      }).length,
      evening: slots.filter(s => parseInt(s.time.split(':')[0]) >= 17).length
    };
  };
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-16 h-16 animate-spin text-primary" />
        <p className="text-[22px] mt-4 text-muted-foreground font-medium">
          System rezerwacji n2wash.com
        </p>
      </div>
    );
  }

  // STEP 1: PHONE NUMBER & CAR MODEL INPUT
  if (step === 'phone') {
    return <div className={cn("pb-16", slideDirection === 'forward' ? "animate-slide-in-left" : "animate-slide-in-right")}>
        <section className="py-4 md:py-6 text-center">
          <div className="container">
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              {t('booking.title')}
            </h1>
          </div>
        </section>

        <section className="container pb-6">
          <div className="max-w-sm mx-auto">
            <div className="glass-card p-4 space-y-4">
              <div>
                <Label htmlFor="phone" className="text-base font-medium">{t('booking.phonePlaceholder')}</Label>
                <div className="relative mt-1">
                  <Input id="phone" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="" className="h-12 text-base" autoFocus />
                  {isCheckingCustomer && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                </div>
                {isVerifiedCustomer && customerPhone.length >= 9 && <p className="text-green-600 mt-1.5 flex items-center gap-1 text-base">
                    <Check className="w-3 h-3" /> {t('booking.verifiedCustomer')}
                  </p>}
              </div>

              {/* Car model input */}
              {customerPhone.length >= 9 && <div className="animate-fade-in">
                  <Label htmlFor="carModel" className="text-base font-medium">{t('reservations.carModel')}</Label>
                  <div className="mt-1">
                    <CarSearchAutocomplete value={carModel} onChange={(val: CarSearchValue) => {
                  if (val === null) {
                    setCarModel('');
                  } else if ('type' in val && val.type === 'custom') {
                    setCarModel(val.label);
                    // Custom input - default to medium size
                    setCarSize('medium');
                  } else if ('size' in val) {
                    // It's a CarModel with size
                    setCarModel(val.label);
                    // Use size from carsList.json directly
                    const sizeMap: Record<string, 'small' | 'medium' | 'large'> = {
                      'S': 'small',
                      'M': 'medium',
                      'L': 'large'
                    };
                    setCarSize(sizeMap[val.size] || 'medium');
                  }
                }} className="[&_input]:h-12 [&_input]:text-base" />
                  </div>
                  {/* Historical car models from previous reservations - show bubbles only for 2+ vehicles */}
                  {historicalCarModels.length > 1 && <div className="flex flex-wrap gap-2 mt-2 py-[8px]">
                      {historicalCarModels.map(({
                  model,
                  count
                }) => <button key={model} type="button" onClick={() => setCarModel(model)} className={cn("inline-flex items-center px-4 py-2.5 rounded-full text-sm font-medium transition-colors border min-h-[44px]", carModel === model ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-accent hover:border-accent")}>
                          {model}
                        </button>)}
                    </div>}
                </div>}

              {/* Name input - optional */}
              {customerPhone.length >= 9 && <div className="animate-fade-in">
                  <Label htmlFor="customerName" className="text-base font-medium">{t('booking.yourName')}</Label>
                  <Input id="customerName" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('booking.namePlaceholder')} className="h-12 text-base mt-1" />
                </div>}

              <Button onClick={() => goToStep('service', 'forward')} className="w-full" disabled={customerPhone.length < 9 || isCheckingCustomer}>
                {t('common.next')}
              </Button>
            </div>
          </div>
        </section>
      </div>;
  }

  // STEP 2: SERVICE SELECTION (unified multi-select list)
  if (step === 'service') {
    // Get all selected service IDs (main + addons combined)
    const allSelectedIds = selectedService ? [selectedService.id, ...selectedAddons] : [...selectedAddons];
    const toggleService = (service: Service) => {
      if (allSelectedIds.includes(service.id)) {
        // Remove from selection
        if (selectedService?.id === service.id) {
          // If it was the main service, promote first addon to main or clear
          if (selectedAddons.length > 0) {
            const newMainId = selectedAddons[0];
            const newMain = services.find(s => s.id === newMainId);
            setSelectedService(newMain || null);
            setSelectedAddons(selectedAddons.slice(1));
          } else {
            setSelectedService(null);
          }
        } else {
          // Remove from addons
          setSelectedAddons(selectedAddons.filter(id => id !== service.id));
        }
      } else {
        // Add to selection
        if (!selectedService) {
          setSelectedService(service);
        } else {
          setSelectedAddons([...selectedAddons, service.id]);
        }
      }
    };
    const canContinue = allSelectedIds.length > 0;
    const renderServiceItem = (service: Service) => {
      const price = getServicePrice(service);
      const duration = getServiceDuration(service);
      const isSelected = allSelectedIds.includes(service.id);
      return <button key={service.id} onClick={() => toggleService(service)} className={cn('glass-card p-3 text-left transition-all w-full', isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50')}>
          <div className="grid grid-cols-[24px,1fr,auto] items-start gap-3">
            {/* Large checkbox */}
            <div className={cn('w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5', isSelected ? 'border-primary bg-primary' : 'border-muted-foreground')}>
              {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
            </div>

            <div className="min-w-0 overflow-hidden">
              <h3 className="font-medium text-foreground truncate">
                {service.name}
              </h3>
              {service.description && <ServiceDescription description={service.description} serviceId={service.id} />}
              <p className="text-muted-foreground text-sm">{duration} min</p>
            </div>

            <span className="font-semibold text-primary whitespace-nowrap">
              {t('booking.priceFrom', {
              price
            })}
            </span>
          </div>
        </button>;
    };
    return <div className="min-h-screen bg-background pb-16 overflow-x-hidden">
        <div className={cn("px-4 py-4 max-w-[550px] mx-auto w-full", slideDirection === 'forward' ? "animate-slide-in-left" : "animate-slide-in-right")}>
          <button onClick={() => goToStep('phone', 'back')} className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4 text-base">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>

          <h2 className="font-semibold mb-1 text-xl">{t('booking.selectService')}</h2>
          <p className="text-muted-foreground mb-3 text-base">
            {t('booking.priceNote') || 'Ostateczny koszt usługi może się nieznacznie różnić.'}
          </p>

          {/* All services visible */}
          <div className="grid gap-2 mb-3">
            {services.map(renderServiceItem)}
          </div>

          {/* CTA Button */}
          <div className="mt-6">
            <Button onClick={() => goToStep('datetime', 'forward')} className="w-full h-12 text-base" disabled={!canContinue}>
              {t('common.next')} {allSelectedIds.length > 0 && `(${allSelectedIds.length})`}
            </Button>
          </div>
        </div>
      </div>;
  }

  // STEP 2: DATE & TIME SELECTION (Booksy-style full month calendar)
  if (step === 'datetime') {
    // Generate calendar days for the current month view
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, {
      weekStartsOn: 1
    });
    const calendarEnd = endOfWeek(monthEnd, {
      weekStartsOn: 1
    });
    const calendarDays: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      calendarDays.push(day);
      day = addDays(day, 1);
    }
    const dayNames = [t('calendar.dayNamesShort.mon'), t('calendar.dayNamesShort.tue'), t('calendar.dayNamesShort.wed'), t('calendar.dayNamesShort.thu'), t('calendar.dayNamesShort.fri'), t('calendar.dayNamesShort.sat'), t('calendar.dayNamesShort.sun')];

    // Check if a date has available slots
    const hasAvailableSlots = (date: Date): boolean => {
      const dayData = availableDays.find(d => isSameDay(d.date, date));
      return dayData ? dayData.slots.length > 0 : false;
    };

    // Get slots for selected date
    const selectedDayData = selectedDate ? availableDays.find(d => isSameDay(d.date, selectedDate)) : null;
    const availableSlots = selectedDayData?.slots || [];

    // Month navigation
    const canGoPreviousMonth = !isBefore(endOfMonth(subMonths(currentMonth, 1)), startOfDay(new Date()));
    const goToPreviousMonth = () => {
      if (canGoPreviousMonth) {
        setCurrentMonth(subMonths(currentMonth, 1));
      }
    };
    const goToNextMonth = () => {
      setCurrentMonth(addMonths(currentMonth, 1));
    };
    return <div className="min-h-screen bg-background pb-16">
        <div className={cn("container py-4 max-w-[550px] mx-auto", slideDirection === 'forward' ? "animate-slide-in-left" : "animate-slide-in-right")}>
          {/* Header with back button */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => {
            if (editMode && existingReservation) {
              // In edit mode, go back to reservation page
              navigate(`/res?code=${existingReservation.confirmation_code}`);
            } else {
              goToStep('service', 'back');
              setSelectedDate(null);
              setSelectedTime(null);
            }
          }} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-base">
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </button>
          </div>

          {/* Page title */}
          <h2 className="text-xl font-semibold mb-2">{t('booking.selectDateTime')}</h2>

          {/* Service info */}
          <p className="mb-4 text-base text-inherit">
            {selectedService?.name} • {getTotalDuration()} min
            {selectedAddons.length > 0 && ` (+ ${selectedAddons.length} ${t('booking.addons')})`}
          </p>

          {/* Month header with navigation */}
          <div className="flex items-center justify-between px-2 mb-4">
            <button onClick={goToPreviousMonth} disabled={!canGoPreviousMonth} className={cn("p-2 rounded-full transition-colors", canGoPreviousMonth ? "hover:bg-muted text-muted-foreground" : "opacity-30 cursor-not-allowed")}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-semibold capitalize">
              {format(currentMonth, 'LLLL yyyy', {
              locale: pl
            })}
            </span>
            <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day names header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(dayName => <div key={dayName} className="text-center text-xs font-medium text-muted-foreground py-2">
                {dayName}
              </div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 mb-6">
            {calendarDays.map(calDay => {
            const isPast = isBefore(calDay, startOfDay(new Date()));
            const isSelected = selectedDate && isSameDay(calDay, selectedDate);
            const isTodayDate = isToday(calDay);
            const isCurrentMonth = isSameMonth(calDay, currentMonth);
            const hasSlots = hasAvailableSlots(calDay);
            return <button key={calDay.toISOString()} onClick={() => {
              if (!isPast && isCurrentMonth && hasSlots) {
                setSelectedDate(calDay);
                // Auto-select first available slot for this day
                const dayData = availableDays.find(d => isSameDay(d.date, calDay));
                if (dayData && dayData.slots.length > 0) {
                  const firstSlot = dayData.slots[0];
                  setSelectedTime(firstSlot.time);
                  setSelectedStationId(firstSlot.availableStationIds[0]);
                }
              }
            }} disabled={isPast || !isCurrentMonth || !hasSlots} className={cn("relative flex items-center justify-center h-11 w-full rounded-full text-sm font-medium transition-all duration-200", !isCurrentMonth && "text-muted-foreground/30", isPast && isCurrentMonth && "text-muted-foreground/50 cursor-not-allowed", !hasSlots && isCurrentMonth && !isPast && "text-muted-foreground/50 cursor-not-allowed", !isPast && isCurrentMonth && hasSlots && !isSelected && "hover:bg-secondary", isTodayDate && !isSelected && "ring-2 ring-primary/30 ring-inset", isSelected && "bg-primary text-primary-foreground shadow-lg")}>
                  <span>{format(calDay, 'd')}</span>
                </button>;
          })}
          </div>

          {/* Horizontal scrollable time slots */}
          {selectedDate && <div className="border-t border-border pt-4">
              {availableSlots.length > 0 ? <div ref={slotsScrollRef} className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
                  {availableSlots.map(slot => {
              const isSelected = selectedTime === slot.time;
              return <button key={slot.time} onClick={() => handleSelectTime(slot)} className={cn("flex-shrink-0 py-3 px-5 rounded-2xl text-base font-medium transition-all duration-200 min-w-[80px]", isSelected ? "bg-primary text-primary-foreground shadow-lg" : "bg-card border-2 border-border hover:border-primary/50")}>
                        {slot.time}
                      </button>;
            })}
                </div> : <p className="text-center text-base text-muted-foreground py-4">
                  {t('booking.noSlotsForDay')}
                </p>}
            </div>}

          {!selectedDate && <p className="text-center text-base text-muted-foreground py-4">
              {t('booking.selectDate')}
            </p>}

          {/* CTA Button */}
          <div className="mt-6">
            <Button onClick={handleConfirmDateTime} className="w-full h-12 text-base" disabled={!selectedDate || !selectedTime}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      </div>;
  }

  // STEP 3: SUMMARY WITH DATA & VERIFICATION
  if (step === 'summary') {
    return <div className="min-h-screen bg-background pb-16">
        <div className={cn("container py-4 max-w-[550px] mx-auto", slideDirection === 'forward' ? "animate-slide-in-left" : "animate-slide-in-right")}>
          <button onClick={() => {
          goToStep('datetime', 'back');
          setSmsSent(false);
          setVerificationCode('');
          setSmsError(false);
          setShowResendButton(false);
        }} className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-3 text-base">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>

          <h2 className="font-semibold text-xl mb-4">{t('booking.summary')}</h2>

          {/* Booking summary - order: Date, Time, Service(s), Vehicle */}
          <div className="glass-card p-3 mb-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-base">{t('common.date')}</span>
              <span className="font-medium text-base">
                {selectedDate && format(selectedDate, 'd MMMM', {
                locale: pl
              })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-base">{t('common.time')}</span>
              <span className="font-medium text-base">
                {selectedTime} - {(() => {
                const [h, m] = (selectedTime || '00:00').split(':').map(Number);
                const totalMinutes = h * 60 + m + getTotalDuration();
                const endH = Math.floor(totalMinutes / 60);
                const endM = totalMinutes % 60;
                return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
              })()}
              </span>
            </div>
            {carModel && <div className="flex justify-between">
              <span className="text-muted-foreground text-base">{t('reservations.carModel')}</span>
              <span className="font-medium text-base">{carModel}</span>
            </div>}
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground text-base">{t('reservations.service')}</span>
              <div className="text-right">
                <span className="font-medium text-base block">{selectedService?.name}</span>
                {selectedAddons.map(addonId => {
                const addon = services.find(s => s.id === addonId);
                return addon ? <span key={addonId} className="font-medium text-base block">{addon.name}</span> : null;
              })}
              </div>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-border">
              <span className="text-muted-foreground text-base font-semibold">{t('common.price')}</span>
              <span className="font-bold text-primary text-base">{getTotalPrice()} {t('common.currency')}</span>
            </div>
            <p className="text-muted-foreground text-sm">
              * {t('booking.priceDisclaimer')}
            </p>
          </div>

          {/* Upsell suggestion - only show if feature is enabled, conditions are met, and NOT in edit mode */}
          {!editMode && hasFeature('upsell') && selectedService && selectedDate && selectedTime && selectedStationId && <UpsellSuggestion selectedService={selectedService} selectedTime={selectedTime} selectedDate={selectedDate} selectedStationId={selectedStationId} services={services} stations={stations} availabilityBlocks={availabilityBlocks} carSize={carSize} onAddService={serviceId => {
          setSelectedAddons(prev => [...prev, serviceId]);
        }} selectedAddons={selectedAddons} />}

          {/* In edit mode - just show save button without verification */}
          {editMode ? <Button onClick={handleUpdateReservation} className="w-full text-base" disabled={isSaving || !selectedDate || !selectedTime}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('myReservation.saveChanges')}
            </Button> : <>
              {/* Customer data - VAT invoice option */}
              <div className="glass-card p-3 mb-3 space-y-3">
                {/* VAT Invoice checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={wantsInvoice} onCheckedChange={checked => setWantsInvoice(checked === true)} className="h-5 w-5" disabled={smsSent} />
                  <span className="text-sm font-medium">{t('booking.needInvoice')}</span>
                </label>

                {/* NIP input - shown when invoice is requested */}
                {wantsInvoice && <div className="animate-fade-in">
                    <Label htmlFor="nip" className="text-xs">{t('booking.nipNumber')}</Label>
                    <Input id="nip" value={nipNumber} onChange={e => setNipNumber(e.target.value)} placeholder="np. 1234567890" className="mt-1 h-9 text-sm" disabled={smsSent} maxLength={13} />
                  </div>}
              </div>

              {/* Collapsible notes - outside the card */}
              <Collapsible open={showNotes} onOpenChange={setShowNotes} className="mb-3">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-0 py-[8px]">
                  {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span className="text-base">{t('booking.additionalNotes')} ({t('common.optional')})</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Textarea id="notes" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} placeholder={t('booking.notesPlaceholder')} className="text-base resize-none" rows={2} disabled={smsSent} />
                </CollapsibleContent>
              </Collapsible>

              {/* SMS verification or direct booking */}
              {!smsSent ? <>
                  <Button onClick={handleReservationClick} className="w-full text-base" disabled={isSendingSms || isCheckingCustomer || !customerName.trim() || !customerPhone.trim() || wantsInvoice && !nipNumber.trim()}>
                    {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t('booking.confirmBooking')}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-3 text-center pt-[8px]">
                    {t('booking.rodoConsent')}{' '}
                    <button type="button" onClick={() => setShowRodoDialog(true)} className="underline hover:text-foreground transition-colors">
                      {t('booking.rodoLink')}
                    </button>
                    .
                  </p>

                  {/* RODO Dialog */}
                  <Dialog open={showRodoDialog} onOpenChange={setShowRodoDialog}>
                    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{t('booking.rodoTitle')}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        <p className="font-semibold">{t('booking.rodoWhoManagesTitle')}</p>
                        <p>{t('booking.rodoWhoManagesIntro')}</p>
                        <ul className="list-disc pl-5 space-y-2">
                          <li>
                            <strong>{t('booking.rodoPartner')}</strong> {instance?.name}{instance?.address ? `, ${instance.address}` : ''} – {t('booking.rodoPartnerPurpose')}
                          </li>
                          <li>
                            <strong>{t('booking.rodoOperator')}</strong> Tomasz Nastały Sinpai, ul. Prezydenta Lecha Kaczyńskiego 31 lok. 19, 81-810 Gdańsk, NIP 5851474597 – {t('booking.rodoOperatorPurpose')}
                          </li>
                        </ul>

                        <p className="font-semibold">{t('booking.rodoPurposeTitle')}</p>
                        <ul className="list-disc pl-5 space-y-2">
                          <li>
                            <strong>{t('booking.rodoPurposeReservation')}</strong> {t('booking.rodoPurposeReservationDesc')}
                          </li>
                          <li>
                            <strong>{t('booking.rodoPurposeContact')}</strong> {t('booking.rodoPurposeContactDesc')}
                          </li>
                          <li>
                            <strong>{t('booking.rodoPurposeMarketing')}</strong> {t('booking.rodoPurposeMarketingDesc')}
                          </li>
                        </ul>
                      </div>
                    </DialogContent>
                  </Dialog>
                </> : <div className="glass-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('booking.enterSmsCode')}
                  </p>
                  
                  <OTPInputWithAutoFocus value={verificationCode} onChange={setVerificationCode} onComplete={handleVerifyCode} smsSent={smsSent} isVerifying={isVerifying} />
                  {isVerifying && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('booking.verifying')}
                    </div>}
                  {showResendButton && !isVerifying && <Button variant="outline" size="sm" onClick={() => {
              setSmsSent(false);
              setVerificationCode('');
              setShowResendButton(false);
              handleSendSms();
            }} disabled={isSendingSms} className="mt-3">
                      {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t('booking.resendCode')}
                    </Button>}
                </div>}
            </>}
        </div>
      </div>;
  }

  // STEP: SUCCESS
  if (step === 'success' && confirmationData) {
    const isPending = confirmationData.status === 'pending';
    return <div className="min-h-screen bg-background pb-16">
        <div className={cn("container py-6 max-w-[550px] mx-auto", slideDirection === 'forward' ? "animate-slide-in-left" : "animate-slide-in-right")}>
          <div className="max-w-sm mx-auto text-center">
            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3", isPending ? "bg-amber-500/20" : "bg-green-500/20")}>
              {isPending ? <Clock className="w-7 h-7 text-amber-500" /> : <Check className="w-7 h-7 text-green-500" />}
            </div>

            <h2 className="font-semibold mb-2 text-xl">
              {isPending ? t('booking.bookingPending') : t('booking.bookingSuccess')}
            </h2>
            
            {isPending && <p className="text-muted-foreground mb-4 text-base">{t('booking.bookingPendingMessage') || 'Dziękujemy za złożenie rezerwacji. Potwierdzimy ją możliwie szybko.'}</p>}

            <div className="glass-card p-3 mb-4 text-left space-y-1.5">
              <div className="flex justify-between items-center pb-1.5 border-b border-border">
                <span className="text-muted-foreground text-base">{t('common.status')}</span>
                <span className={cn("font-medium px-2 py-0.5 rounded text-xs", isPending ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600")}>
                  {isPending ? t('reservations.pending') : t('reservations.confirmed')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-base">{t('common.date')}</span>
                <span className="font-medium text-base">
                  {format(parseISO(confirmationData.date), 'd MMM yyyy', {
                  locale: pl
                })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-base">{t('common.time')}</span>
                <span className="font-medium text-base">
                  {confirmationData.time} - {(() => {
                  const [h, m] = (confirmationData.time || '00:00').split(':').map(Number);
                  const totalMinutes = h * 60 + m + getTotalDuration();
                  const endH = Math.floor(totalMinutes / 60);
                  const endM = totalMinutes % 60;
                  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
                })()}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground text-base">{t('reservations.service')}</span>
                <span className="font-medium text-base">{confirmationData.serviceName}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border">
                <span className="text-muted-foreground text-base font-semibold">{t('common.price')}</span>
                <span className="font-bold text-primary text-base">{confirmationData.price}</span>
              </div>
              <p className="text-muted-foreground text-sm">
                * {t('booking.priceDisclaimer')}
              </p>
            </div>


            {instance?.auto_confirm_reservations && <div className="glass-card p-3 mb-4 text-xs text-muted-foreground">
                <Clock className="w-4 h-4 inline-block mr-1.5 text-primary" />
                {t('booking.reminderInfo')}
              </div>}

            {/* PWA Install Suggestion */}
            <div className="text-center text-sm text-muted-foreground mb-4">
              <p>
                {t('pwa.fasterBooking')}{' '}
                <button onClick={() => setShowInstallPrompt(true)} className="text-primary underline hover:no-underline">
                  {t('pwa.addShortcut')}
                </button>
              </p>
            </div>

            {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="glass-card p-4 flex items-center gap-3 hover:border-pink-500/50 transition-all group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium group-hover:text-pink-500 transition-colors">{t('booking.followUsOnInstagram')}</p>
                  <p className="text-xs text-muted-foreground">{t('booking.instagramSubtitle')}</p>
                </div>
              </a>}

          </div>
        </div>

        {/* SMS Dialog for web */}
        {instance && <SendSmsDialog phone={instance.phone || ''} customerName={instance.name} instanceId={instance.id} open={smsDialogOpen} onClose={() => setSmsDialogOpen(false)} />}
        
        {/* PWA Install Prompt */}
        <IOSInstallPrompt open={showInstallPrompt} onClose={() => setShowInstallPrompt(false)} instanceName={instance?.name} instanceLogo={null} />
      </div>;
  }
  return null;
}