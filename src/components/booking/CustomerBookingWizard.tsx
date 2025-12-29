import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, ArrowLeft, Instagram, Loader2, Bug, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
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
import { searchCarModels } from '@/data/carModels';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useInstanceFeatures } from '@/hooks/useInstanceFeatures';
import UpsellSuggestion from './UpsellSuggestion';
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
  working_hours: Record<string, {
    open: string;
    close: string;
  } | null> | null;
  social_facebook: string | null;
  social_instagram: string | null;
  booking_days_ahead: number;
}
interface AvailabilityBlock {
  block_date: string;
  start_time: string;
  end_time: string;
  station_id: string;
}
interface CustomerBookingWizardProps {
  onLayoutChange?: (hidden: boolean) => void;
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
export default function CustomerBookingWizard({
  onLayoutChange
}: CustomerBookingWizardProps) {
  const [step, setStep] = useState<Step>('phone');
  const [instance, setInstance] = useState<Instance | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAddons, setShowAddons] = useState(false);
  const [loading, setLoading] = useState(true);

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
  const [isInferringCarSize, setIsInferringCarSize] = useState(false);

  // Date/time carousel state
  const [dayScrollIndex, setDayScrollIndex] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [slotScrollIndex, setSlotScrollIndex] = useState(0);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
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

  // Dev mode
  const [devMode, setDevMode] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Success
  const [confirmationData, setConfirmationData] = useState<{
    confirmationCode: string;
    date: string;
    time: string;
    serviceName: string;
    status: 'confirmed' | 'pending';
  } | null>(null);
  const [socialLinks, setSocialLinks] = useState<{
    facebook: string | null;
    instagram: string | null;
  }>({
    facebook: null,
    instagram: null
  });
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
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

  // Notify parent about layout changes - hide layout for all steps except phone
  useEffect(() => {
    if (onLayoutChange) {
      onLayoutChange(step !== 'phone');
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

  // Check if customer is verified when phone changes
  useEffect(() => {
    const checkCustomer = async () => {
      if (!instance || customerPhone.length < 9) {
        setIsVerifiedCustomer(false);
        return;
      }
      let normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+48' + normalizedPhone;
      }
      setIsCheckingCustomer(true);
      const {
        data: customer
      } = await supabase.from('customers').select('id, name, phone_verified').eq('phone', normalizedPhone).eq('instance_id', instance.id).maybeSingle();
      if (customer) {
        setIsVerifiedCustomer(customer.phone_verified === true);
        if (customer.name && !customerName) {
          setCustomerName(customer.name);
        }
      } else {
        setIsVerifiedCustomer(false);
      }
      setIsCheckingCustomer(false);
    };
    const timeoutId = setTimeout(checkCustomer, 500);
    return () => clearTimeout(timeoutId);
  }, [customerPhone, instance]);

  // Fetch customer vehicles from dedicated table
  useEffect(() => {
    const fetchCustomerVehicles = async () => {
      if (!instance || customerPhone.length < 9) {
        setHistoricalCarModels([]);
        return;
      }
      let normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+48' + normalizedPhone;
      }
      const {
        data: vehicles
      } = await supabase.from('customer_vehicles').select('model, usage_count').eq('instance_id', instance.id).or(`phone.eq.${normalizedPhone},phone.eq.${normalizedPhone.replace('+48', '')}`).order('usage_count', {
        ascending: false
      }).limit(5);
      if (vehicles && vehicles.length > 0) {
        const sortedModels = vehicles.map(v => ({
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
    };
    const timeoutId = setTimeout(fetchCustomerVehicles, 600);
    return () => clearTimeout(timeoutId);
  }, [customerPhone, instance]);

  // Auto-infer car size from car model using AI
  useEffect(() => {
    const inferCarSize = async () => {
      if (!carModel || carModel.length < 3) return;
      setIsInferringCarSize(true);
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('suggest-car-size', {
          body: {
            carModel
          }
        });
        if (!error && data?.carSize) {
          const size = data.carSize as 'small' | 'medium' | 'large';
          if (['small', 'medium', 'large'].includes(size)) {
            setCarSize(size);
          }
        }
      } catch (e) {
        console.log('Car size inference failed, using default');
      } finally {
        setIsInferringCarSize(false);
      }
    };
    const timeoutId = setTimeout(inferCarSize, 800);
    return () => clearTimeout(timeoutId);
  }, [carModel]);

  // Auto-select first available time of day when date changes (moved from datetime step)
  // Using inline logic to avoid dependency on functions defined later
  useEffect(() => {
    if (selectedDate && step === 'datetime' && selectedService && instance?.working_hours && stations.length > 0) {
      // Recalculate available days inline to get slots for selected date
      const serviceDuration = selectedService.duration_minutes || 60;
      const compatibleStations = stations.filter(s => {
        if (!selectedService.station_type) return true;
        return s.type === selectedService.station_type || s.type === 'universal';
      });
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

        // Count slots by time of day
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
  }, [selectedDate, step, selectedService, instance, stations, availabilityBlocks]);
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
      const {
        data: instanceData
      } = await supabase.from('instances').select('*').eq('active', true).limit(1).maybeSingle();
      if (instanceData) {
        const parsedInstance: Instance = {
          id: instanceData.id,
          name: instanceData.name,
          phone: instanceData.phone,
          working_hours: instanceData.working_hours as Record<string, {
            open: string;
            close: string;
          } | null> | null,
          social_facebook: instanceData.social_facebook,
          social_instagram: instanceData.social_instagram,
          booking_days_ahead: instanceData.booking_days_ahead ?? 90
        };
        setInstance(parsedInstance);
        const {
          data: servicesData
        } = await supabase.from('services').select('*').eq('instance_id', instanceData.id).eq('active', true).order('sort_order');
        setServices(servicesData as Service[] || []);
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
  }, []);
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
    for (let i = 0; i < daysAhead; i++) {
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
    setDayScrollIndex(0);
    setSlotScrollIndex(0);
  };
  const handleSelectTime = (slot: TimeSlot) => {
    setSelectedTime(slot.time);
    setSelectedStationId(slot.availableStationIds[0]);
    setStep('summary'); // Go directly to summary
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
        title: 'Uzupełnij dane',
        description: 'Podaj imię i numer telefonu',
        variant: 'destructive'
      });
      return;
    }
    if (!selectedService || !selectedDate || !selectedTime || !instance) {
      toast({
        title: 'Błąd',
        description: 'Brak wymaganych danych',
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
          title: 'Błąd',
          description: data.error || 'Nie udało się utworzyć rezerwacji',
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
        status: data.reservation.status || 'confirmed'
      });
      setSocialLinks({
        facebook: data.instance?.social_facebook || null,
        instagram: data.instance?.social_instagram || null
      });
      setStep('success');
    } catch (error) {
      console.error('Error creating direct reservation:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się utworzyć rezerwacji',
        variant: 'destructive'
      });
    } finally {
      setIsSendingSms(false);
    }
  };
  const handleSendSms = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: 'Uzupełnij dane',
        description: 'Podaj imię i numer telefonu',
        variant: 'destructive'
      });
      return;
    }
    if (!selectedService || !selectedDate || !selectedTime || !instance) {
      toast({
        title: 'Błąd',
        description: 'Brak wymaganych danych',
        variant: 'destructive'
      });
      return;
    }
    setIsSendingSms(true);
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
      if (devMode && response.data?.devCode) {
        setDevCode(response.data.devCode);
      }
      toast({
        title: 'Kod wysłany',
        description: 'Wpisz 4-cyfrowy kod z SMS'
      });
      setSmsSent(true);
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się wysłać SMS',
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
        title: 'Nieprawidłowy kod',
        description: 'Wpisz 4-cyfrowy kod z SMS',
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
          title: 'Błędny kod',
          description: data.error || 'Sprawdź kod i spróbuj ponownie',
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
        status: data.reservation.status || 'confirmed'
      });
      setSocialLinks({
        facebook: data.instance?.social_facebook || null,
        instagram: data.instance?.social_instagram || null
      });
      setStep('success');
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: 'Błąd weryfikacji',
        description: 'Sprawdź kod i spróbuj ponownie',
        variant: 'destructive'
      });
    } finally {
      setIsVerifying(false);
    }
  }, [verificationCode, instance, customerPhone, saveCustomerToLocalStorage]);
  const handleReservationClick = () => {
    if (devMode) {
      handleSendSms();
      return;
    }
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
    return <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }

  // STEP 1: PHONE NUMBER & CAR MODEL INPUT
  if (step === 'phone') {
    return <div className="animate-fade-in">
        <section className="py-4 md:py-6 text-center">
          <div className="container">
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Zarezerwuj wizytę
            </h1>
          </div>
        </section>

        <section className="container pb-6">
          <div className="max-w-sm mx-auto">
            <div className="glass-card p-4 space-y-4">
              <div>
                <Label htmlFor="phone" className="text-base font-medium">Numer telefonu</Label>
                <div className="relative mt-1">
                  <Input id="phone" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="" className="h-12 text-base" autoFocus />
                  {isCheckingCustomer && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                </div>
                {isVerifiedCustomer && customerPhone.length >= 9 && <p className="text-green-600 mt-1.5 flex items-center gap-1 text-base">
                    <Check className="w-3 h-3" /> Witaj ponownie!
                  </p>}
              </div>

              {/* Car model input - moved from summary step */}
              {customerPhone.length >= 9 && <div className="animate-fade-in">
                  <Label htmlFor="carModel" className="text-base font-medium">Marka i model samochodu</Label>
                  <div className="relative mt-1">
                    <Input id="carModel" value={carModel} onChange={e => setCarModel(e.target.value)} placeholder="np. Volkswagen Golf" className="h-12 text-base" />
                    {isInferringCarSize && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                  </div>
                  {/* Historical car models from previous reservations */}
                  {historicalCarModels.length > 0 && <div className="flex flex-wrap gap-2 mt-2 py-[8px]">
                      {historicalCarModels.map(({
                  model,
                  count
                }) => <button key={model} type="button" onClick={() => setCarModel(model)} className={cn("inline-flex items-center px-4 py-2.5 rounded-full text-sm font-medium transition-colors border min-h-[44px]", carModel === model ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-accent hover:border-accent")}>
                          {model}
                        </button>)}
                    </div>}
                  {/* Car model suggestions from database */}
                  {historicalCarModels.length === 0 && carModel.length >= 2 && (() => {
                const suggestions = searchCarModels(carModel, 3);
                if (suggestions.length === 0 || suggestions.some(s => s.toLowerCase() === carModel.toLowerCase())) return null;
                return <div className="flex flex-wrap gap-2 mt-2">
                        {suggestions.map(model => <button key={model} type="button" onClick={() => setCarModel(model)} className="inline-flex items-center px-4 py-2.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors min-h-[44px]">
                            {model}
                          </button>)}
                      </div>;
              })()}
                </div>}

              <Button onClick={() => setStep('service')} className="w-full" disabled={customerPhone.length < 9 || isCheckingCustomer}>
                Dalej
              </Button>
            </div>
          </div>
        </section>
      </div>;
  }

  // STEP 2: SERVICE SELECTION (with addons collapsible)
  if (step === 'service') {
    return <div className="min-h-screen bg-background">
        <div className="container py-4 animate-fade-in max-w-[550px] mx-auto">
          <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4 text-base">
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </button>

          <h2 className="font-semibold mb-1 text-xl">Wybierz usługę</h2>
          <p className="text-muted-foreground mb-3 text-base">
            Ostateczny koszt usługi może się nieznacznie różnić, np. w przypadku bardzo silnych zabrudzeń.
          </p>

          <div className="grid gap-2 mb-3">
            {popularServices.map(service => {
            const price = getServicePrice(service);
            const duration = getServiceDuration(service);
            return <div key={service.id} className="glass-card p-3 hover:border-primary/50 transition-all group">
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {service.name}
                      </h3>
                      <p className="text-muted-foreground text-sm">{duration} min</p>
                    </div>
                    <span className="font-semibold text-primary whitespace-nowrap">
                      od {price} zł
                    </span>
                    <Button size="sm" onClick={() => handleSelectService(service)}>
                      Wybierz
                    </Button>
                  </div>
                </div>;
          })}
          </div>

          {otherServices.length > 0 && <>
              <div className="flex justify-center my-4">
                <Button variant="outline" onClick={() => setShowAllServices(!showAllServices)} className="gap-2">
                  {showAllServices ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showAllServices ? 'Zwiń usługi' : `Więcej usług (${otherServices.length})`}
                </Button>
              </div>

              {showAllServices && <div className="grid gap-2 animate-fade-in">
                  {otherServices.map(service => {
              const price = getServicePrice(service);
              const duration = getServiceDuration(service);
              return <div key={service.id} className="glass-card p-3 hover:border-primary/50 transition-all group">
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">
                              {service.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">{duration} min</p>
                          </div>
                          <span className="font-semibold text-primary whitespace-nowrap">
                            od {price} zł
                          </span>
                          <Button size="sm" onClick={() => handleSelectService(service)}>
                            Wybierz
                          </Button>
                        </div>
                      </div>;
            })}
                </div>}
            </>}

          {/* Addons section - collapsible, on first step */}
          {selectedService && addonServices.length > 0 && <Collapsible open={showAddons} onOpenChange={setShowAddons} className="mt-4">
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2">
                {showAddons ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>Wybierz dodatkowe usługi</span>
                {selectedAddons.length > 0 && <span className="ml-auto text-primary font-medium">({selectedAddons.length})</span>}
              </CollapsibleTrigger>
              <CollapsibleContent className="animate-fade-in">
                <div className="grid gap-2 mt-2">
                  {addonServices.slice(0, 6).map(service => <button key={service.id} onClick={() => toggleAddon(service.id)} className={cn('glass-card p-3 text-left transition-all', selectedAddons.includes(service.id) ? 'border-primary bg-primary/5' : 'hover:border-primary/50')}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0', selectedAddons.includes(service.id) ? 'border-primary bg-primary' : 'border-muted-foreground')}>
                          {selectedAddons.includes(service.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{service.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-primary">+{service.price_from || 0} zł</span>
                      </div>
                    </button>)}
                </div>
              </CollapsibleContent>
            </Collapsible>}
        </div>
      </div>;
  }

  // STEP 2: DATE & TIME SELECTION (Booksy-style)
  if (step === 'datetime') {
    const VISIBLE_DAYS = 6;
    const visibleDays = availableDays.slice(dayScrollIndex, dayScrollIndex + VISIBLE_DAYS);
    const canScrollDaysLeft = dayScrollIndex > 0;
    const canScrollDaysRight = dayScrollIndex + VISIBLE_DAYS < availableDays.length;
    const selectedDay = selectedDate ? availableDays.find(d => isSameDay(d.date, selectedDate)) : null;
    const filteredSlots = selectedDay ? filterSlotsByTimeOfDay(selectedDay.slots, timeOfDay) : [];
    const slotsCount = selectedDay ? getSlotsCountByTimeOfDay(selectedDay.slots) : {
      morning: 0,
      afternoon: 0,
      evening: 0
    };

    // Slots carousel
    const VISIBLE_SLOTS = 5;
    const visibleSlots = filteredSlots.slice(slotScrollIndex, slotScrollIndex + VISIBLE_SLOTS);
    const canScrollSlotsLeft = slotScrollIndex > 0;
    const canScrollSlotsRight = slotScrollIndex + VISIBLE_SLOTS < filteredSlots.length;

    // Get month/year range for header
    const getMonthRange = () => {
      if (visibleDays.length === 0) return '';
      const firstDate = visibleDays[0].date;
      const lastDate = visibleDays[visibleDays.length - 1].date;
      const firstMonth = format(firstDate, 'LLLL yyyy', {
        locale: pl
      });
      const lastMonth = format(lastDate, 'LLLL yyyy', {
        locale: pl
      });
      if (firstMonth === lastMonth) return firstMonth.charAt(0).toUpperCase() + firstMonth.slice(1);
      return `${format(firstDate, 'LLLL', {
        locale: pl
      }).charAt(0).toUpperCase() + format(firstDate, 'LLLL', {
        locale: pl
      }).slice(1)} - ${format(lastDate, 'LLLL yyyy', {
        locale: pl
      }).charAt(0).toUpperCase() + format(lastDate, 'LLLL yyyy', {
        locale: pl
      }).slice(1)}`;
    };
    return <div className="min-h-screen bg-background">
        <div className="container py-4 animate-fade-in max-w-[550px] mx-auto">
          {/* Header with back button */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => {
            setStep('service');
            setSelectedDate(null);
            setSelectedTime(null);
          }} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-base">
              <ArrowLeft className="w-4 h-4" />
              Wróć
            </button>
            
          </div>

          {/* Month header */}
          <h2 className="text-xl font-bold mb-4">{getMonthRange()}</h2>

          {/* Service info */}
          <p className="mb-4 text-base text-inherit">
            {selectedService?.name} • {getTotalDuration()} min
            {selectedAddons.length > 0 && ` (+ ${selectedAddons.length} dodatki)`}
          </p>

          {/* Days carousel */}
          <div className="flex items-center gap-1 mb-6">
            <button onClick={() => setDayScrollIndex(Math.max(0, dayScrollIndex - 1))} disabled={!canScrollDaysLeft} className={cn("p-1 rounded-full transition-colors", canScrollDaysLeft ? "hover:bg-muted" : "opacity-30 cursor-not-allowed")}>
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 flex justify-center gap-1 overflow-hidden">
              {visibleDays.map(day => {
              const isSelected = selectedDate && isSameDay(selectedDate, day.date);
              const hasSlots = day.slots.length > 0;
              const dayOfWeek = format(day.date, 'EEEEEE', {
                locale: pl
              }); // Pn, Wt, Śr...
              const dayNum = format(day.date, 'd');
              return <button key={day.date.toISOString()} onClick={() => {
                setSelectedDate(day.date);
                setSlotScrollIndex(0);
              }} disabled={!hasSlots} className={cn("flex flex-col items-center justify-center w-14 h-16 rounded-lg border transition-all", isSelected ? "border-primary bg-background" : "border-border hover:border-muted-foreground", !hasSlots && "opacity-40 cursor-not-allowed")}>
                    <span className="text-xs text-muted-foreground capitalize">{dayOfWeek}</span>
                    <span className={cn("text-lg font-semibold", isSelected && "text-foreground")}>{dayNum}</span>
                    {hasSlots && <div className={cn("w-4 h-0.5 rounded-full mt-0.5", isSelected ? "bg-primary" : "bg-green-500")} />}
                  </button>;
            })}
            </div>

            <button onClick={() => setDayScrollIndex(Math.min(availableDays.length - VISIBLE_DAYS, dayScrollIndex + 1))} disabled={!canScrollDaysRight} className={cn("p-1 rounded-full transition-colors", canScrollDaysRight ? "hover:bg-muted" : "opacity-30 cursor-not-allowed")}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Time of day tabs */}
          {selectedDay && <>
              <div className="flex justify-center gap-2 mb-4">
                <button onClick={() => {
              setTimeOfDay('morning');
              setSlotScrollIndex(0);
            }} disabled={slotsCount.morning === 0} className={cn("px-4 py-2 rounded-full text-sm font-medium transition-all", timeOfDay === 'morning' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50", slotsCount.morning === 0 && "opacity-40 cursor-not-allowed")}>
                  Rano
                </button>
                <button onClick={() => {
              setTimeOfDay('afternoon');
              setSlotScrollIndex(0);
            }} disabled={slotsCount.afternoon === 0} className={cn("px-4 py-2 rounded-full text-sm font-medium transition-all", timeOfDay === 'afternoon' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50", slotsCount.afternoon === 0 && "opacity-40 cursor-not-allowed")}>
                  Popołudnie
                </button>
                <button onClick={() => {
              setTimeOfDay('evening');
              setSlotScrollIndex(0);
            }} disabled={slotsCount.evening === 0} className={cn("px-4 py-2 rounded-full text-sm font-medium transition-all", timeOfDay === 'evening' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50", slotsCount.evening === 0 && "opacity-40 cursor-not-allowed")}>
                  Wieczór
                </button>
              </div>

              {/* Time slots carousel */}
              {filteredSlots.length > 0 ? <div className="flex items-center gap-1">
                  <button onClick={() => setSlotScrollIndex(Math.max(0, slotScrollIndex - 1))} disabled={!canScrollSlotsLeft} className={cn("p-1 rounded-full transition-colors", canScrollSlotsLeft ? "hover:bg-muted" : "opacity-30 cursor-not-allowed")}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex-1 flex justify-center gap-2 overflow-hidden">
                    {visibleSlots.map((slot, index) => <button key={slot.time} onClick={() => handleSelectTime(slot)} className={cn("px-4 py-3 rounded-lg border text-sm font-medium transition-all min-w-[70px]", index === 0 && selectedTime === slot.time ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary hover:bg-primary/10")}>
                        {slot.time}
                      </button>)}
                  </div>

                  <button onClick={() => setSlotScrollIndex(Math.min(filteredSlots.length - VISIBLE_SLOTS, slotScrollIndex + 1))} disabled={!canScrollSlotsRight} className={cn("p-1 rounded-full transition-colors", canScrollSlotsRight ? "hover:bg-muted" : "opacity-30 cursor-not-allowed")}>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div> : <p className="text-center text-sm text-muted-foreground py-4">
                  Brak dostępnych godzin w tym zakresie
                </p>}
            </>}

          {!selectedDay && <p className="text-center text-sm text-muted-foreground py-8">
              Wybierz dzień, aby zobaczyć dostępne godziny
            </p>}
        </div>
      </div>;
  }

  // STEP 3: SUMMARY WITH DATA & VERIFICATION
  if (step === 'summary') {
    return <div className="min-h-screen bg-background">
        <div className="container py-4 animate-fade-in max-w-[550px] mx-auto">
          <button onClick={() => {
          setStep('datetime');
          setSmsSent(false);
          setVerificationCode('');
        }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </button>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Podsumowanie</h2>
            
            {/* Dev Mode Checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={devMode} onCheckedChange={checked => setDevMode(checked === true)} className="h-3.5 w-3.5" />
              <Bug className="w-3 h-3" />
              <span>Dev</span>
            </label>
          </div>

          {/* Booking summary */}
          <div className="glass-card p-3 mb-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usługa</span>
              <span className="font-medium">{selectedService?.name}</span>
            </div>
            {selectedAddons.length > 0 && <div className="flex justify-between">
                <span className="text-muted-foreground">Dodatki</span>
                <span className="font-medium">{selectedAddons.length}</span>
              </div>}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">
                {selectedDate && format(selectedDate, 'd MMMM', {
                locale: pl
              })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Godzina</span>
              <span className="font-medium">{selectedTime}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-border">
              <span className="text-muted-foreground">Cena</span>
              <span className="font-bold text-primary">{getTotalPrice()} zł</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              * Cena może ulec zmianie w zależności od stanu samochodu
            </p>
          </div>

          {/* Upsell suggestion - only show if feature is enabled and conditions are met */}
          {hasFeature('upsell') && selectedService && selectedDate && selectedTime && selectedStationId && <UpsellSuggestion selectedService={selectedService} selectedTime={selectedTime} selectedDate={selectedDate} selectedStationId={selectedStationId} services={services} stations={stations} availabilityBlocks={availabilityBlocks} carSize={carSize} onAddService={serviceId => {
          setSelectedAddons(prev => [...prev, serviceId]);
        }} selectedAddons={selectedAddons} />}

          {/* Customer data - phone and car model already provided in first step */}
          <div className="glass-card p-3 mb-3 space-y-3">
            <div>
              <Label htmlFor="name" className="text-xs">Imię i nazwisko *</Label>
              <Input id="name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1 h-9 text-sm" disabled={smsSent} />
            </div>

            {/* Show car model as read-only info */}
            {carModel && <div className="text-xs text-muted-foreground">
                Samochód: <span className="font-medium text-foreground">{carModel}</span>
                {' '}({carSize === 'small' ? 'mały' : carSize === 'medium' ? 'średni' : 'duży'})
              </div>}

            {/* Collapsible notes */}
            <Collapsible open={showNotes} onOpenChange={setShowNotes}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>Uwagi (opcjonalnie)</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Textarea id="notes" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} placeholder="np. bardzo brudne felgi, pies w aucie..." className="text-sm resize-none" rows={2} disabled={smsSent} />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* SMS verification or direct booking */}
          {!smsSent ? <>
              {devMode && <div className="mb-3 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600 dark:text-yellow-400">
                  <Bug className="w-3 h-3 inline-block mr-1" />
                  Dev Mode: wymuszono weryfikację SMS
                </div>}
              <Button onClick={handleReservationClick} className="w-full" disabled={isSendingSms || isCheckingCustomer || !customerName.trim() || !customerPhone.trim()}>
                {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isVerifiedCustomer && !devMode ? 'Rezerwuj' : 'Potwierdź'}
              </Button>
            </> : <div className="glass-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-3">
                Wpisz 4-cyfrowy kod z SMS
              </p>
              
              {devMode && devCode && <div className="mb-3 p-2 rounded-md bg-green-500/10 border border-green-500/30 text-sm font-mono text-green-600 dark:text-green-400">
                  <Bug className="w-3 h-3 inline-block mr-1" />
                  Kod: <strong>{devCode}</strong>
                </div>}
              
              <OTPInputWithAutoFocus value={verificationCode} onChange={setVerificationCode} onComplete={handleVerifyCode} smsSent={smsSent} isVerifying={isVerifying} />
              {isVerifying && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Weryfikacja...
                </div>}
            </div>}
        </div>
      </div>;
  }

  // STEP: SUCCESS
  if (step === 'success' && confirmationData) {
    const isPending = confirmationData.status === 'pending';
    return <div className="min-h-screen bg-background">
        <div className="container py-6 animate-fade-in max-w-[550px] mx-auto">
          <div className="max-w-sm mx-auto text-center">
            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3", isPending ? "bg-amber-500/20" : "bg-green-500/20")}>
              {isPending ? <Clock className="w-7 h-7 text-amber-500" /> : <Check className="w-7 h-7 text-green-500" />}
            </div>

            <h2 className="text-lg font-semibold mb-2">
              {isPending ? 'Rezerwacja przyjęta!' : 'Rezerwacja potwierdzona!'}
            </h2>
            
            {isPending && <p className="text-sm text-muted-foreground mb-4">
                Dziękujemy za złożenie rezerwacji. Potwierdzimy ją możliwie szybko.
              </p>}

            <div className="glass-card p-3 mb-4 text-left space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usługa</span>
                <span className="font-medium">{confirmationData.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">
                  {format(parseISO(confirmationData.date), 'd MMM yyyy', {
                  locale: pl
                })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Godzina</span>
                <span className="font-medium">{confirmationData.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-medium px-2 py-0.5 rounded text-xs", isPending ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600")}>
                  {isPending ? 'Oczekuje na potwierdzenie' : 'Potwierdzona'}
                </span>
              </div>
            </div>

            {/* SMS Contact Button - only on mobile */}
            {isPending && instance?.phone && isMobile && <Button variant="outline" className="w-full mb-4 gap-2" onClick={() => {
            if (instance.phone) {
              // Create SMS template: "Rezerwacja DZIEN GODZINA:MINUTY SAMOCHOD USLUGA"
              const dateFormatted = format(parseISO(confirmationData.date), 'd.MM', {
                locale: pl
              });
              const smsBody = encodeURIComponent(`Rezerwacja ${dateFormatted} ${confirmationData.time} ${carModel || ''} ${confirmationData.serviceName}`);
              window.location.href = `sms:${instance.phone}?body=${smsBody}`;
            }
          }}>
                <MessageSquare className="w-4 h-4" />
                Napisz do nas
              </Button>}

            <div className="glass-card p-3 mb-4 text-xs text-muted-foreground">
              <Clock className="w-4 h-4 inline-block mr-1.5 text-primary" />
              Wyślemy Ci przypomnienie SMS dzień przed oraz godzinę przed wizytą
            </div>

            {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="glass-card p-4 flex items-center gap-3 hover:border-pink-500/50 transition-all group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium group-hover:text-pink-500 transition-colors">Zaobserwuj nas na Instagramie!</p>
                  <p className="text-xs text-muted-foreground">Bądź na bieżąco z naszymi realizacjami</p>
                </div>
              </a>}

            <Button variant="ghost" onClick={() => window.location.reload()} className="w-full text-muted-foreground" size="sm">
              Zarezerwuj kolejną wizytę
            </Button>
          </div>
        </div>

        {/* SMS Dialog for web */}
        {instance && <SendSmsDialog phone={instance.phone || ''} customerName={instance.name} instanceId={instance.id} open={smsDialogOpen} onClose={() => setSmsDialogOpen(false)} />}
      </div>;
  }
  return null;
}