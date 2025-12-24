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
  category_id: string | null;
  subcategory: string | null;
}

interface Station {
  id: string;
  name: string;
  type: string;
}

interface TimeSlot {
  time: string;
  stationId: string;
  stationName: string;
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

interface Reservation {
  id: string;
  station_id: string | null;
  reservation_date: string;
  start_time: string;
  end_time: string;
}

const POPULAR_KEYWORDS = ['mycie', 'pranie', 'detailing'];

const features = [
  { icon: <Sparkles className="w-5 h-5" />, title: 'Profesjonalna obsługa' },
  { icon: <Shield className="w-5 h-5" />, title: 'Gwarancja jakości' },
  { icon: <Clock className="w-5 h-5" />, title: 'Szybka rezerwacja' },
  { icon: <Star className="w-5 h-5" />, title: 'Zadowoleni klienci' },
];

type Step = 'service' | 'date' | 'addons' | 'info' | 'verify' | 'success';

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

  // Verification
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);

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

      // Fetch first active instance
      const { data: instanceData } = await supabase
        .from('instances')
        .select('*')
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (instanceData) {
        // Parse working hours properly
        const parsedInstance: Instance = {
          id: instanceData.id,
          name: instanceData.name,
          working_hours: instanceData.working_hours as Record<string, { open: string; close: string } | null> | null,
          social_facebook: instanceData.social_facebook,
          social_instagram: instanceData.social_instagram,
        };
        setInstance(parsedInstance);

        // Fetch services
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .eq('instance_id', instanceData.id)
          .eq('active', true)
          .order('sort_order');

        setServices((servicesData as Service[]) || []);

        // Fetch stations
        const { data: stationsData } = await supabase
          .from('stations')
          .select('*')
          .eq('instance_id', instanceData.id)
          .eq('active', true)
          .order('sort_order');

        setStations((stationsData as Station[]) || []);

        // Fetch reservations for next 14 days
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

  // Split services into popular and other
  const popularServices = services.filter((s) =>
    POPULAR_KEYWORDS.some((k) => s.name.toLowerCase().includes(k))
  ).slice(0, 3);

  const otherServices = services.filter((s) => !popularServices.includes(s));

  // Get price for service
  const getServicePrice = (service: Service): number => {
    if (service.requires_size) {
      if (carSize === 'small') return service.price_small || service.price_from || 0;
      if (carSize === 'large') return service.price_large || service.price_from || 0;
      return service.price_medium || service.price_from || 0;
    }
    return service.price_from || 0;
  };

  // Calculate available slots for each day
  const getAvailableDays = (): AvailableDay[] => {
    if (!selectedService || !instance?.working_hours) return [];

    const days: AvailableDay[] = [];
    const today = new Date();
    const serviceDuration = selectedService.duration_minutes || 60;

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayName = format(date, 'EEEE', { locale: pl }).toLowerCase();
      const workingHours = instance.working_hours[dayName];

      if (!workingHours) continue;

      const dateStr = format(date, 'yyyy-MM-dd');
      const dayReservations = reservations.filter((r) => r.reservation_date === dateStr);

      const slots: TimeSlot[] = [];

      for (const station of stations) {
        const stationReservations = dayReservations.filter((r) => r.station_id === station.id);

        // Calculate free ranges
        const [openH, openM] = workingHours.open.split(':').map(Number);
        const [closeH, closeM] = workingHours.close.split(':').map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        // Sort reservations
        const sortedRes = stationReservations
          .map((r) => ({
            start: parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]),
            end: parseInt(r.end_time.split(':')[0]) * 60 + parseInt(r.end_time.split(':')[1]),
          }))
          .sort((a, b) => a.start - b.start);

        // Find free slots
        let currentTime = openMinutes;
        
        // Skip past time if today
        if (i === 0) {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30; // Add 30 min buffer
          currentTime = Math.max(currentTime, Math.ceil(nowMinutes / 15) * 15);
        }

        for (const res of sortedRes) {
          while (currentTime + serviceDuration <= res.start && currentTime + serviceDuration <= closeMinutes) {
            slots.push({
              time: `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`,
              stationId: station.id,
              stationName: station.name,
            });
            currentTime += 15;
          }
          currentTime = Math.max(currentTime, res.end);
        }

        // Fill remaining time
        while (currentTime + serviceDuration <= closeMinutes) {
          slots.push({
            time: `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`,
            stationId: station.id,
            stationName: station.name,
          });
          currentTime += 15;
        }
      }

      if (slots.length > 0) {
        days.push({ date, slots });
      }
    }

    return days;
  };

  // Group slots by station for selected date
  const getSlotsByStation = (): Record<string, TimeSlot[]> => {
    if (!selectedDate) return {};

    const days = getAvailableDays();
    const selectedDay = days.find((d) => isSameDay(d.date, selectedDate));
    if (!selectedDay) return {};

    const grouped: Record<string, TimeSlot[]> = {};
    for (const slot of selectedDay.slots) {
      if (!grouped[slot.stationId]) {
        grouped[slot.stationId] = [];
      }
      grouped[slot.stationId].push(slot);
    }

    return grouped;
  };

  // Handle service selection
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setStep('date');
  };

  // Handle time slot selection
  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedTime(slot.time);
    setSelectedStationId(slot.stationId);
    setStep('addons');
  };

  // Calculate total price
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

  // Toggle addon
  const toggleAddon = (serviceId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  // Submit reservation
  const handleSubmitReservation = async () => {
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
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({ title: 'Kod wysłany', description: 'Sprawdź SMS i wpisz kod weryfikacyjny' });
      setStep('verify');

    } catch (error) {
      console.error('Error sending SMS:', error);
      toast({ title: 'Błąd', description: 'Nie udało się wysłać SMS', variant: 'destructive' });
    } finally {
      setIsSendingSms(false);
    }
  };

  // Verify code
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
  const slotsByStation = getSlotsByStation();
  const addonServices = services.filter((s) => s.id !== selectedService?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // STEP: SERVICE SELECTION
  if (step === 'service') {
    return (
      <div className="animate-fade-in">
        {/* Mini Hero */}
        <section className="relative overflow-hidden hero-gradient py-6 md:py-10">
          <div className="container text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Zarezerwuj wizytę w <span className="gradient-text">ARM CAR AUTO SPA</span>
            </h1>
          </div>
        </section>

        {/* Services */}
        <section className="container py-8">
          <h2 className="text-lg font-semibold mb-4">Wybierz usługę</h2>

          {/* Popular Services */}
          <div className="grid gap-3 mb-4">
            {popularServices.map((service) => (
              <button
                key={service.id}
                onClick={() => handleSelectService(service)}
                className="glass-card p-4 text-left hover:border-primary/50 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {service.duration_minutes} min
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary">
                      od {service.price_from || service.price_small || 0} zł
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Other Services Toggle */}
          {otherServices.length > 0 && (
            <>
              <button
                onClick={() => setShowAllServices(!showAllServices)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                {showAllServices ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showAllServices ? 'Zwiń' : 'Pokaż więcej usług'}
              </button>

              {showAllServices && (
                <div className="grid gap-3 animate-fade-in">
                  {otherServices.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleSelectService(service)}
                      className="glass-card p-4 text-left hover:border-primary/50 transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {service.name}
                          </h3>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {service.duration_minutes} min
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-primary">
                            od {service.price_from || service.price_small || 0} zł
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Features at bottom */}
        <section className="container pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="text-primary">{feature.icon}</div>
                <span>{feature.title}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // STEP: DATE & TIME SELECTION
  if (step === 'date') {
    return (
      <div className="container py-6 animate-fade-in">
        <button
          onClick={() => setStep('service')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Wróć
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-semibold">Wybierz termin</h2>
          <p className="text-sm text-muted-foreground">
            {selectedService?.name} • {selectedService?.duration_minutes} min
          </p>
        </div>

        {/* Days */}
        <div className="space-y-6">
          {availableDays.slice(0, 7).map((day) => (
            <div key={day.date.toISOString()} className="glass-card p-4">
              <button
                onClick={() => setSelectedDate(isSameDay(selectedDate || new Date(0), day.date) ? null : day.date)}
                className="w-full text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold capitalize">
                      {format(day.date, 'EEEE', { locale: pl })}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {format(day.date, 'd MMMM', { locale: pl })}
                    </p>
                  </div>
                  <span className="text-sm text-primary">{day.slots.length} wolnych</span>
                </div>
              </button>

              {selectedDate && isSameDay(selectedDate, day.date) && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(slotsByStation).map(([stationId, slots]) => {
                      const station = stations.find((s) => s.id === stationId);
                      return (
                        <div key={stationId} className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Stanowisko {station?.name || stationId.slice(0, 4)}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {slots.slice(0, 12).map((slot) => (
                              <button
                                key={`${slot.stationId}-${slot.time}`}
                                onClick={() => handleSelectSlot(slot)}
                                className={cn(
                                  'px-3 py-1.5 text-sm rounded-lg border transition-all',
                                  'hover:border-primary hover:bg-primary/10'
                                )}
                              >
                                {slot.time}
                              </button>
                            ))}
                            {slots.length > 12 && (
                              <span className="text-xs text-muted-foreground self-center">
                                +{slots.length - 12} więcej
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STEP: ADDONS
  if (step === 'addons') {
    return (
      <div className="container py-6 animate-fade-in">
        <button
          onClick={() => setStep('date')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Wróć
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-semibold">Dodatkowe usługi</h2>
          <p className="text-sm text-muted-foreground">Opcjonalnie wybierz dodatkowe usługi</p>
        </div>

        {/* Car size selector if needed */}
        {selectedService?.requires_size && (
          <div className="glass-card p-4 mb-4">
            <Label className="text-sm font-medium mb-3 block">Rozmiar samochodu</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setCarSize(size)}
                  className={cn(
                    'py-2 px-3 rounded-lg border text-sm transition-all',
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
        <div className="grid gap-3 mb-6">
          {addonServices.slice(0, 6).map((service) => (
            <button
              key={service.id}
              onClick={() => toggleAddon(service.id)}
              className={cn(
                'glass-card p-4 text-left transition-all',
                selectedAddons.includes(service.id) ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-5 h-5 rounded border flex items-center justify-center',
                  selectedAddons.includes(service.id) ? 'border-primary bg-primary' : 'border-muted-foreground'
                )}>
                  {selectedAddons.includes(service.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  )}
                </div>
                <span className="font-semibold text-primary">
                  +{service.price_from || 0} zł
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Summary & Continue */}
        <div className="glass-card p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground">Suma</span>
            <span className="text-xl font-bold text-primary">{getTotalPrice()} zł</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            * Cena może ulec zmianie w zależności od stanu samochodu
          </p>
          <Button onClick={() => setStep('info')} className="w-full">
            Dalej
          </Button>
        </div>
      </div>
    );
  }

  // STEP: CUSTOMER INFO
  if (step === 'info') {
    return (
      <div className="container py-6 animate-fade-in">
        <button
          onClick={() => setStep('addons')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Wróć
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-semibold">Twoje dane</h2>
          <p className="text-sm text-muted-foreground">
            {selectedService?.name} • {selectedDate && format(selectedDate, 'd MMMM', { locale: pl })} • {selectedTime}
          </p>
        </div>

        <div className="glass-card p-4 space-y-4 mb-6">
          <div>
            <Label htmlFor="name">Imię / Nazwisko / Ksywka</Label>
            <Input
              id="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="np. Jan lub AutoMax"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefon *</Label>
            <Input
              id="phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="np. 600 123 456"
              className="mt-1"
              required
            />
          </div>
        </div>

        {/* Summary */}
        <div className="glass-card p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground">Do zapłaty</span>
            <span className="text-xl font-bold text-primary">{getTotalPrice()} zł</span>
          </div>
          <p className="text-xs text-muted-foreground">
            * Cena może ulec zmianie w zależności od stanu samochodu
          </p>
        </div>

        <Button 
          onClick={handleSubmitReservation} 
          className="w-full" 
          disabled={isSendingSms || !customerName.trim() || !customerPhone.trim()}
        >
          {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Rezerwuj
        </Button>
      </div>
    );
  }

  // STEP: SMS VERIFICATION
  if (step === 'verify') {
    return (
      <div className="container py-6 animate-fade-in">
        <div className="max-w-sm mx-auto text-center">
          <h2 className="text-lg font-semibold mb-2">Weryfikacja SMS</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Wpisz 4-cyfrowy kod wysłany na numer {customerPhone}
          </p>

          <div className="flex justify-center mb-6">
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
            disabled={isVerifying || verificationCode.length !== 4}
          >
            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Potwierdź
          </Button>
        </div>
      </div>
    );
  }

  // STEP: SUCCESS
  if (step === 'success' && confirmationData) {
    return (
      <div className="container py-6 animate-fade-in">
        <div className="max-w-sm mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>

          <h2 className="text-xl font-semibold mb-2">Rezerwacja potwierdzona!</h2>
          <p className="text-muted-foreground mb-6">
            Twój kod rezerwacji:
          </p>

          <div className="glass-card p-4 mb-6">
            <span className="text-3xl font-mono font-bold text-primary tracking-wider">
              {confirmationData.confirmationCode}
            </span>
          </div>

          <div className="glass-card p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usługa</span>
              <span className="font-medium">{confirmationData.serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">
                {format(parseISO(confirmationData.date), 'd MMMM yyyy', { locale: pl })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Godzina</span>
              <span className="font-medium">{confirmationData.time}</span>
            </div>
          </div>

          {/* Social Links */}
          {(socialLinks.facebook || socialLinks.instagram) && (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-3">Obserwuj nas</p>
              <div className="flex justify-center gap-4">
                {socialLinks.facebook && (
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center hover:bg-blue-600/30 transition-colors"
                  >
                    <Facebook className="w-5 h-5 text-blue-500" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-pink-600/20 flex items-center justify-center hover:bg-pink-600/30 transition-colors"
                  >
                    <Instagram className="w-5 h-5 text-pink-500" />
                  </a>
                )}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
            Nowa rezerwacja
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
