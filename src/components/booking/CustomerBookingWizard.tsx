import { useState, useEffect } from 'react';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Sparkles, Shield, Clock, Star, ChevronDown, ChevronUp, Check, ArrowLeft, Facebook, Instagram, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

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
  stationId: string;
}

interface AvailabilityRange {
  stationId: string;
  slots: TimeSlot[];
  startTime: string;
  endTime: string;
}

interface AvailableDay {
  date: Date;
  ranges: AvailabilityRange[];
}

interface Instance {
  id: string;
  name: string;
  working_hours: Record<string, { open: string; close: string } | null> | null;
  social_facebook: string | null;
  social_instagram: string | null;
}

interface Reservation {
  id: string;
  station_id: string | null;
  reservation_date: string;
  start_time: string;
  end_time: string;
}

const POPULAR_KEYWORDS = ['mycie', 'pranie', 'detailing'];

const features = [
  { icon: <Sparkles className="w-4 h-4" />, title: 'Profesjonalna obsługa' },
  { icon: <Shield className="w-4 h-4" />, title: 'Gwarancja jakości' },
  { icon: <Clock className="w-4 h-4" />, title: 'Szybka rezerwacja' },
  { icon: <Star className="w-4 h-4" />, title: 'Zadowoleni klienci' },
];

type Step = 'service' | 'datetime' | 'addons' | 'summary' | 'success';

export default function CustomerBookingWizard() {
  const [step, setStep] = useState<Step>('service');
  const [instance, setInstance] = useState<Instance | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // Verification
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  // Success
  const [confirmationData, setConfirmationData] = useState<{
    confirmationCode: string;
    date: string;
    time: string;
    serviceName: string;
  } | null>(null);
  const [socialLinks, setSocialLinks] = useState<{ facebook: string | null; instagram: string | null }>({ facebook: null, instagram: null });

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

        const { data: reservationsData } = await supabase
          .from('reservations')
          .select('id, station_id, reservation_date, start_time, end_time')
          .eq('instance_id', instanceData.id)
          .gte('reservation_date', format(today, 'yyyy-MM-dd'))
          .lte('reservation_date', format(endDate, 'yyyy-MM-dd'))
          .neq('status', 'cancelled');

        setReservations((reservationsData as Reservation[]) || []);
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

  // Calculate available days with ranges per station
  const getAvailableDays = (): AvailableDay[] => {
    if (!selectedService || !instance?.working_hours) return [];

    const days: AvailableDay[] = [];
    const today = new Date();
    const serviceDuration = selectedService.duration_minutes || 60;

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayName = format(date, 'EEEE').toLowerCase(); // English day name for DB lookup
      const workingHours = instance.working_hours[dayName];

      if (!workingHours) continue;

      const dateStr = format(date, 'yyyy-MM-dd');
      const dayReservations = reservations.filter((r) => r.reservation_date === dateStr);

      const ranges: AvailabilityRange[] = [];

      for (const station of stations) {
        const stationReservations = dayReservations.filter((r) => r.station_id === station.id);

        const [openH, openM] = workingHours.open.split(':').map(Number);
        const [closeH, closeM] = workingHours.close.split(':').map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        const sortedRes = stationReservations
          .map((r) => ({
            start: parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]),
            end: parseInt(r.end_time.split(':')[0]) * 60 + parseInt(r.end_time.split(':')[1]),
          }))
          .sort((a, b) => a.start - b.start);

        // Find continuous free ranges
        let currentTime = openMinutes;
        
        if (i === 0) {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
          currentTime = Math.max(currentTime, Math.ceil(nowMinutes / 15) * 15);
        }

        let rangeStart: number | null = null;
        const stationSlots: TimeSlot[] = [];

        const checkAndAddSlot = (time: number) => {
          if (time + serviceDuration <= closeMinutes) {
            if (rangeStart === null) rangeStart = time;
            stationSlots.push({
              time: `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`,
              stationId: station.id,
            });
            return true;
          }
          return false;
        };

        for (const res of sortedRes) {
          while (currentTime + serviceDuration <= res.start && currentTime + serviceDuration <= closeMinutes) {
            checkAndAddSlot(currentTime);
            currentTime += 15;
          }
          currentTime = Math.max(currentTime, res.end);
        }

        while (currentTime + serviceDuration <= closeMinutes) {
          checkAndAddSlot(currentTime);
          currentTime += 15;
        }

        if (stationSlots.length > 0) {
          const firstSlot = stationSlots[0].time;
          const lastSlotTime = stationSlots[stationSlots.length - 1].time;
          const [lastH, lastM] = lastSlotTime.split(':').map(Number);
          const endMinutes = lastH * 60 + lastM + serviceDuration;
          const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

          ranges.push({
            stationId: station.id,
            slots: stationSlots,
            startTime: firstSlot,
            endTime: endTime,
          });
        }
      }

      if (ranges.length > 0) {
        days.push({ date, ranges });
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
    setSelectedStationId(slot.stationId);
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

  // STEP 2: DATE & TIME SELECTION
  if (step === 'datetime') {
    const selectedDay = selectedDate ? availableDays.find((d) => isSameDay(d.date, selectedDate)) : null;

    return (
      <div className="container py-4 animate-fade-in">
        <button
          onClick={() => { setStep('service'); setSelectedDate(null); setSelectedTime(null); }}
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
            const totalSlots = day.ranges.reduce((acc, r) => acc + r.slots.length, 0);
            
            return (
              <button
                key={day.date.toISOString()}
                onClick={() => setSelectedDate(isSelected ? null : day.date)}
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
                  <span className="text-xs text-primary">{totalSlots} wolnych</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected day - show ranges as columns */}
        {selectedDay && (
          <div className="glass-card p-4 animate-fade-in">
            <h3 className="text-sm font-medium mb-3">Dostępne godziny</h3>
            <div className={cn(
              "grid gap-4",
              selectedDay.ranges.length === 1 && "grid-cols-1",
              selectedDay.ranges.length === 2 && "grid-cols-2",
              selectedDay.ranges.length >= 3 && "grid-cols-2 md:grid-cols-3"
            )}>
              {selectedDay.ranges.map((range, idx) => (
                <div key={range.stationId} className="space-y-2">
                  <div className="text-xs text-muted-foreground text-center pb-1 border-b border-border">
                    {range.startTime} - {range.endTime}
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {range.slots.map((slot) => (
                      <button
                        key={`${slot.stationId}-${slot.time}`}
                        onClick={() => handleSelectTime(slot)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-border hover:border-primary hover:bg-primary/10 transition-all"
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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

        <h2 className="text-base font-semibold mb-4">Podsumowanie</h2>

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

        {/* Customer data */}
        <div className="glass-card p-3 mb-3 space-y-3">
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
            <Label htmlFor="phone" className="text-xs">Telefon *</Label>
            <Input
              id="phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="np. 600 123 456"
              className="mt-1 h-9 text-sm"
              required
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

        {/* SMS verification */}
        {!smsSent ? (
          <Button 
            onClick={handleSendSms} 
            className="w-full" 
            disabled={isSendingSms || !customerName.trim() || !customerPhone.trim()}
          >
            {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Rezerwuj
          </Button>
        ) : (
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              Wpisz 4-cyfrowy kod z SMS
            </p>
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
