import { useState, useEffect } from 'react';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Sparkles, Shield, Clock, Star, ChevronDown, ChevronUp, Check, ArrowLeft, Facebook, Instagram, Loader2, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Checkbox } from '@/components/ui/checkbox';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  requires_size: boolean | null;
}

interface Station {
  id: string;
  name: string;
  type: string;
}

interface TimeSlot {
  time: string;
  availableStationIds: string[]; // List of stations available at this time
}

interface AvailableDay {
  date: Date;
  slots: TimeSlot[];
}

interface Instance {
  id: string;
  name: string;
  working_hours: Record<string, { open: string; close: string } | null> | null;
  social_facebook: string | null;
  social_instagram: string | null;
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
const MIN_LEAD_TIME_MINUTES = 30; // Minimum time before booking (30 minutes)
const SLOT_INTERVAL = 15; // Generate slots every 15 minutes
const MAX_VISIBLE_SLOTS = 20; // Show max 20 slots initially

const features = [
  { icon: <Sparkles className="w-4 h-4" />, title: 'Profesjonalna obsługa' },
  { icon: <Shield className="w-4 h-4" />, title: 'Gwarancja jakości' },
  { icon: <Clock className="w-4 h-4" />, title: 'Szybka rezerwacja' },
  { icon: <Star className="w-4 h-4" />, title: 'Zadowoleni klienci' },
];

type Step = 'service' | 'datetime' | 'addons' | 'summary' | 'success';

export default function CustomerBookingWizard({ onLayoutChange }: CustomerBookingWizardProps) {
  const [step, setStep] = useState<Step>('service');
  const [instance, setInstance] = useState<Instance | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMoreSlots, setShowMoreSlots] = useState(false);

  // Selected values
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [carSize, setCarSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

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
  } | null>(null);
  const [socialLinks, setSocialLinks] = useState<{ facebook: string | null; instagram: string | null }>({ facebook: null, instagram: null });

  // Notify parent about layout changes
  useEffect(() => {
    if (onLayoutChange) {
      onLayoutChange(step === 'datetime');
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

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, phone_verified')
        .eq('phone', normalizedPhone)
        .eq('instance_id', instance.id)
        .maybeSingle();

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

  const saveCustomerToLocalStorage = () => {
    localStorage.setItem('bookingCustomerData', JSON.stringify({
      phone: customerPhone,
      name: customerName,
      carModel: carModel,
    }));
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: instanceData } = await supabase
        .from('instances')
        .select('*')
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (instanceData) {
        const parsedInstance: Instance = {
          id: instanceData.id,
          name: instanceData.name,
          working_hours: instanceData.working_hours as Record<string, { open: string; close: string } | null> | null,
          social_facebook: instanceData.social_facebook,
          social_instagram: instanceData.social_instagram,
        };
        setInstance(parsedInstance);

        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .eq('instance_id', instanceData.id)
          .eq('active', true)
          .order('sort_order');

        setServices((servicesData as Service[]) || []);

        const { data: stationsData } = await supabase
          .from('stations')
          .select('*')
          .eq('instance_id', instanceData.id)
          .eq('active', true)
          .order('sort_order');

        setStations((stationsData as Station[]) || []);

        const today = new Date();
        const endDate = addDays(today, 14);

        // Use backend function to get availability blocks (reservations + breaks)
        const { data: blocksData } = await supabase
          .rpc('get_availability_blocks', {
            _instance_id: instanceData.id,
            _from: format(today, 'yyyy-MM-dd'),
            _to: format(endDate, 'yyyy-MM-dd'),
          });

        setAvailabilityBlocks((blocksData as AvailabilityBlock[]) || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const popularServices = services.filter((s) =>
    POPULAR_KEYWORDS.some((k) => s.name.toLowerCase().includes(k))
  ).slice(0, 3);

  const otherServices = services.filter((s) => !popularServices.includes(s));

  const getServicePrice = (service: Service): number => {
    if (service.requires_size) {
      if (carSize === 'small') return service.price_small || service.price_from || 0;
      if (carSize === 'large') return service.price_large || service.price_from || 0;
      return service.price_medium || service.price_from || 0;
    }
    return service.price_from || 0;
  };

  // NEW LOGIC: Calculate available time slots - shows only times, not stations
  // Customer sees one unified list of possible arrival times
  const getAvailableDays = (): AvailableDay[] => {
    if (!selectedService || !instance?.working_hours || stations.length === 0) return [];

    const days: AvailableDay[] = [];
    const today = new Date();
    const serviceDuration = selectedService.duration_minutes || 60;

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayName = format(date, 'EEEE').toLowerCase();
      const workingHours = instance.working_hours[dayName];

      if (!workingHours) continue;

      const dateStr = format(date, 'yyyy-MM-dd');
      // Filter availability blocks for this date (includes both reservations and breaks)
      const dayBlocks = availabilityBlocks.filter((b) => b.block_date === dateStr);

      const [openH, openM] = workingHours.open.split(':').map(Number);
      const [closeH, closeM] = workingHours.close.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      // Calculate minimum start time (now + lead time for today)
      let minStartTime = openMinutes;
      if (i === 0) {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes() + MIN_LEAD_TIME_MINUTES;
        minStartTime = Math.max(openMinutes, Math.ceil(nowMinutes / SLOT_INTERVAL) * SLOT_INTERVAL);
      }

      // Generate all possible slot times
      const slotMap = new Map<string, string[]>(); // time -> available station IDs

      for (let time = minStartTime; time + serviceDuration <= closeMinutes; time += SLOT_INTERVAL) {
        const timeStr = `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
        const endTime = time + serviceDuration;

        // Check which stations are available for the full duration [time, time+duration)
        const availableStations: string[] = [];

        for (const station of stations) {
          // Get all blocks for this station on this day
          const stationBlocks = dayBlocks.filter((b) => b.station_id === station.id);
          
          // Check if this station has any overlapping blocks (reservations or breaks)
          const hasConflict = stationBlocks.some((block) => {
            const blockStart = parseInt(block.start_time.split(':')[0]) * 60 + parseInt(block.start_time.split(':')[1]);
            const blockEnd = parseInt(block.end_time.split(':')[0]) * 60 + parseInt(block.end_time.split(':')[1]);
            // Overlap check: [time, endTime) overlaps with [blockStart, blockEnd)
            return time < blockEnd && endTime > blockStart;
          });

          if (!hasConflict) {
            availableStations.push(station.id);
          }
        }

        // Only add slot if at least one station is available
        if (availableStations.length > 0) {
          slotMap.set(timeStr, availableStations);
        }
      }

      // Convert map to sorted slots array
      const slots: TimeSlot[] = Array.from(slotMap.entries())
        .map(([time, availableStationIds]) => ({ time, availableStationIds }))
        .sort((a, b) => a.time.localeCompare(b.time));

      if (slots.length > 0) {
        days.push({ date, slots });
      }
    }

    return days;
  };

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setStep('datetime');
  };

  const handleSelectTime = (slot: TimeSlot) => {
    setSelectedTime(slot.time);
    // Automatically assign first available station (customer doesn't see this)
    setSelectedStationId(slot.availableStationIds[0]);
    setStep('addons');
  };

  const toggleAddon = (serviceId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const getTotalPrice = (): number => {
    let total = selectedService ? getServicePrice(selectedService) : 0;
    for (const addonId of selectedAddons) {
      const addon = services.find((s) => s.id === addonId);
      if (addon) {
        total += getServicePrice(addon);
      }
    }
    return total;
  };

  const handleDirectReservation = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({ title: 'Uzupełnij dane', description: 'Podaj imię i numer telefonu', variant: 'destructive' });
      return;
    }

    if (!selectedService || !selectedDate || !selectedTime || !instance) {
      toast({ title: 'Błąd', description: 'Brak wymaganych danych', variant: 'destructive' });
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
            notes: customerNotes.trim() || null,
          },
        },
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
        toast({ title: 'Błąd', description: data.error || 'Nie udało się utworzyć rezerwacji', variant: 'destructive' });
        return;
      }

      saveCustomerToLocalStorage();

      setConfirmationData({
        confirmationCode: data.reservation.confirmationCode,
        date: data.reservation.date,
        time: data.reservation.time,
        serviceName: data.reservation.serviceName,
      });

      setSocialLinks({
        facebook: data.instance?.social_facebook || null,
        instagram: data.instance?.social_instagram || null,
      });

      setStep('success');

    } catch (error) {
      console.error('Error creating direct reservation:', error);
      toast({ title: 'Błąd', description: 'Nie udało się utworzyć rezerwacji', variant: 'destructive' });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSendSms = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({ title: 'Uzupełnij dane', description: 'Podaj imię i numer telefonu', variant: 'destructive' });
      return;
    }

    if (!selectedService || !selectedDate || !selectedTime || !instance) {
      toast({ title: 'Błąd', description: 'Brak wymaganych danych', variant: 'destructive' });
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
            notes: customerNotes.trim() || null,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (devMode && response.data?.devCode) {
        setDevCode(response.data.devCode);
      }

      toast({ title: 'Kod wysłany', description: 'Wpisz 4-cyfrowy kod z SMS' });
      setSmsSent(true);

    } catch (error) {
      console.error('Error sending SMS:', error);
      toast({ title: 'Błąd', description: 'Nie udało się wysłać SMS', variant: 'destructive' });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 4) {
      toast({ title: 'Nieprawidłowy kod', description: 'Wpisz 4-cyfrowy kod z SMS', variant: 'destructive' });
      return;
    }

    if (!instance) return;

    setIsVerifying(true);

    try {
      const response = await supabase.functions.invoke('verify-sms-code', {
        body: {
          phone: customerPhone,
          code: verificationCode,
          instanceId: instance.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (!data.success) {
        toast({ title: 'Błędny kod', description: data.error || 'Sprawdź kod i spróbuj ponownie', variant: 'destructive' });
        return;
      }

      saveCustomerToLocalStorage();

      setConfirmationData({
        confirmationCode: data.reservation.confirmationCode,
        date: data.reservation.date,
        time: data.reservation.time,
        serviceName: data.reservation.serviceName,
      });

      setSocialLinks({
        facebook: data.instance?.social_facebook || null,
        instagram: data.instance?.social_instagram || null,
      });

      setStep('success');

    } catch (error) {
      console.error('Error verifying code:', error);
      toast({ title: 'Błąd weryfikacji', description: 'Sprawdź kod i spróbuj ponownie', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

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
  const addonServices = services.filter((s) => s.id !== selectedService?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // STEP 1: SERVICE SELECTION
  if (step === 'service') {
    return (
      <div className="animate-fade-in">
        <section className="py-4 md:py-6 text-center">
          <div className="container">
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Zarezerwuj wizytę
            </h1>
          </div>
        </section>

        <section className="container pb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Wybierz usługę</h2>

          <div className="grid gap-2 mb-3">
            {popularServices.map((service) => (
              <button
                key={service.id}
                onClick={() => handleSelectService(service)}
                className="glass-card p-3 text-left hover:border-primary/50 transition-all group"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {service.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
                  </div>
                  <span className="font-semibold text-primary whitespace-nowrap ml-3">
                    od {service.price_from || service.price_small || 0} zł
                  </span>
                </div>
              </button>
            ))}
          </div>

          {otherServices.length > 0 && (
            <>
              <button
                onClick={() => setShowAllServices(!showAllServices)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {showAllServices ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllServices ? 'Zwiń' : `Więcej usług (${otherServices.length})`}
              </button>

              {showAllServices && (
                <div className="grid gap-2 animate-fade-in">
                  {otherServices.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleSelectService(service)}
                      className="glass-card p-3 text-left hover:border-primary/50 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {service.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
                        </div>
                        <span className="font-semibold text-primary whitespace-nowrap ml-3">
                          od {service.price_from || service.price_small || 0} zł
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className="container pb-6">
          <div className="flex flex-wrap gap-3 justify-center pt-4 border-t border-border">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-primary">{feature.icon}</span>
                <span>{feature.title}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // STEP 2: DATE & TIME SELECTION (no stations visible)
  if (step === 'datetime') {
    const selectedDay = selectedDate ? availableDays.find((d) => isSameDay(d.date, selectedDate)) : null;
    const visibleSlots = showMoreSlots ? selectedDay?.slots : selectedDay?.slots.slice(0, MAX_VISIBLE_SLOTS);
    const hasMoreSlots = selectedDay && selectedDay.slots.length > MAX_VISIBLE_SLOTS;

    return (
      <div className="min-h-screen bg-background">
        <div className="container py-4 animate-fade-in">
          <button
            onClick={() => { setStep('service'); setSelectedDate(null); setSelectedTime(null); setShowMoreSlots(false); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </button>

          <div className="mb-4">
            <h2 className="text-base font-semibold">Wybierz termin</h2>
            <p className="text-xs text-muted-foreground">
              {selectedService?.name} • {selectedService?.duration_minutes} min
            </p>
          </div>

          <div className="space-y-2 mb-4">
            {availableDays.slice(0, 7).map((day) => {
              const isSelected = selectedDate && isSameDay(selectedDate, day.date);
              const slotsCount = day.slots.length;
              
              return (
                <button
                  key={day.date.toISOString()}
                  onClick={() => { setSelectedDate(isSelected ? null : day.date); setShowMoreSlots(false); }}
                  className={cn(
                    "w-full glass-card p-3 text-left transition-all",
                    isSelected && "border-primary"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium capitalize">
                        {format(day.date, 'EEEE', { locale: pl })}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {format(day.date, 'd MMM', { locale: pl })}
                      </span>
                    </div>
                    <span className="text-xs text-primary">{slotsCount} wolnych</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected day - show unified time slots (no stations) */}
          {selectedDay && (
            <div className="glass-card p-4 animate-fade-in">
              <h3 className="text-sm font-medium mb-3">Dostępne godziny przyjazdu</h3>
              <div className="flex flex-wrap gap-2">
                {visibleSlots?.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => handleSelectTime(slot)}
                    className="px-3 py-2 text-sm rounded-lg border border-border hover:border-primary hover:bg-primary/10 transition-all"
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
              
              {hasMoreSlots && !showMoreSlots && (
                <button
                  onClick={() => setShowMoreSlots(true)}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  Pokaż więcej godzin ({selectedDay.slots.length - MAX_VISIBLE_SLOTS})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 3: ADDONS
  if (step === 'addons') {
    return (
      <div className="container py-4 animate-fade-in">
        <button
          onClick={() => setStep('datetime')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Wróć
        </button>

        <div className="mb-4">
          <h2 className="text-base font-semibold">Dodatkowe usługi</h2>
          <p className="text-xs text-muted-foreground">Opcjonalnie dodaj usługi do rezerwacji</p>
        </div>

        {/* Car size if needed */}
        {selectedService?.requires_size && (
          <div className="glass-card p-3 mb-3">
            <Label className="text-xs font-medium mb-2 block">Rozmiar samochodu</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setCarSize(size)}
                  className={cn(
                    'py-1.5 px-2 rounded-md border text-xs transition-all',
                    carSize === size ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                  )}
                >
                  {size === 'small' ? 'Małe' : size === 'medium' ? 'Średnie' : 'Duże'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Addons */}
        <div className="grid gap-2 mb-4">
          {addonServices.slice(0, 6).map((service) => (
            <button
              key={service.id}
              onClick={() => toggleAddon(service.id)}
              className={cn(
                'glass-card p-3 text-left transition-all',
                selectedAddons.includes(service.id) ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                  selectedAddons.includes(service.id) ? 'border-primary bg-primary' : 'border-muted-foreground'
                )}>
                  {selectedAddons.includes(service.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{service.name}</span>
                </div>
                <span className="text-sm font-semibold text-primary">+{service.price_from || 0} zł</span>
              </div>
            </button>
          ))}
        </div>

        {/* Summary & Continue */}
        <div className="glass-card p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-muted-foreground">Razem</span>
            <span className="text-lg font-bold text-primary">{getTotalPrice()} zł</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            * Cena może ulec zmianie w zależności od stanu samochodu
          </p>
          <Button onClick={() => setStep('summary')} className="w-full" size="sm">
            Dalej
          </Button>
        </div>
      </div>
    );
  }

  // STEP 4: SUMMARY WITH DATA & VERIFICATION
  if (step === 'summary') {
    return (
      <div className="container py-4 animate-fade-in">
        <button
          onClick={() => { setStep('addons'); setSmsSent(false); setVerificationCode(''); }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Wróć
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Podsumowanie</h2>
          
          {/* Dev Mode Checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={devMode}
              onCheckedChange={(checked) => setDevMode(checked === true)}
              className="h-3.5 w-3.5"
            />
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
          {selectedAddons.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dodatki</span>
              <span className="font-medium">{selectedAddons.length}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data</span>
            <span className="font-medium">
              {selectedDate && format(selectedDate, 'd MMMM', { locale: pl })}
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

        {/* Customer data - phone first */}
        <div className="glass-card p-3 mb-3 space-y-3">
          <div>
            <Label htmlFor="phone" className="text-xs">Telefon *</Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="np. 600 123 456"
                className="mt-1 h-9 text-sm pr-8"
                required
                disabled={smsSent}
              />
              {isCheckingCustomer && (
                <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
            </div>
            {isVerifiedCustomer && (
              <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Rozpoznany numer - rezerwacja bez kodu SMS
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="name" className="text-xs">Imię / Nazwa</Label>
            <Input
              id="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="np. Jan lub AutoMax"
              className="mt-1 h-9 text-sm"
              disabled={smsSent}
            />
          </div>
          <div>
            <Label htmlFor="carModel" className="text-xs">Marka i model samochodu</Label>
            <Input
              id="carModel"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
              placeholder="np. Audi Q8"
              className="mt-1 h-9 text-sm"
              disabled={smsSent}
            />
          </div>
          <div>
            <Label htmlFor="notes" className="text-xs">Uwagi (opcjonalnie)</Label>
            <Input
              id="notes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="np. bardzo brudne felgi"
              className="mt-1 h-9 text-sm"
              disabled={smsSent}
            />
          </div>
        </div>

        {/* SMS verification or direct booking */}
        {!smsSent ? (
          <>
            {devMode && (
              <div className="mb-3 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600 dark:text-yellow-400">
                <Bug className="w-3 h-3 inline-block mr-1" />
                Dev Mode: wymuszono weryfikację SMS
              </div>
            )}
            <Button 
              onClick={handleReservationClick} 
              className="w-full" 
              disabled={isSendingSms || isCheckingCustomer || !customerName.trim() || !customerPhone.trim()}
            >
              {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isVerifiedCustomer && !devMode ? 'Rezerwuj' : 'Wyślij kod SMS'}
            </Button>
          </>
        ) : (
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              Wpisz 4-cyfrowy kod z SMS
            </p>
            
            {/* Show dev code when in dev mode */}
            {devMode && devCode && (
              <div className="mb-3 p-2 rounded-md bg-green-500/10 border border-green-500/30 text-sm font-mono text-green-600 dark:text-green-400">
                <Bug className="w-3 h-3 inline-block mr-1" />
                Kod: <strong>{devCode}</strong>
              </div>
            )}
            
            <div className="flex justify-center mb-3">
              <InputOTP
                maxLength={4}
                value={verificationCode}
                onChange={setVerificationCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              onClick={handleVerifyCode}
              className="w-full"
              size="sm"
              disabled={isVerifying || verificationCode.length !== 4}
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Potwierdź
            </Button>
          </div>
        )}
      </div>
    );
  }

  // STEP: SUCCESS
  if (step === 'success' && confirmationData) {
    return (
      <div className="container py-6 animate-fade-in">
        <div className="max-w-sm mx-auto text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7 text-green-500" />
          </div>

          <h2 className="text-lg font-semibold mb-4">Rezerwacja potwierdzona!</h2>

          <div className="glass-card p-3 mb-4 text-left space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usługa</span>
              <span className="font-medium">{confirmationData.serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">
                {format(parseISO(confirmationData.date), 'd MMM yyyy', { locale: pl })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Godzina</span>
              <span className="font-medium">{confirmationData.time}</span>
            </div>
          </div>

          <div className="glass-card p-3 mb-4 text-xs text-muted-foreground">
            <Clock className="w-4 h-4 inline-block mr-1.5 text-primary" />
            Wyslemy Ci przypomnienie SMS dzien przed oraz godzine przed wizyta
          </div>

          {(socialLinks.facebook || socialLinks.instagram) && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Obserwuj nas</p>
              <div className="flex justify-center gap-3">
                {socialLinks.facebook && (
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center hover:bg-blue-600/30 transition-colors"
                  >
                    <Facebook className="w-4 h-4 text-blue-500" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-pink-600/20 flex items-center justify-center hover:bg-pink-600/30 transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-pink-500" />
                  </a>
                )}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={() => window.location.reload()} className="w-full" size="sm">
            Nowa rezerwacja
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
