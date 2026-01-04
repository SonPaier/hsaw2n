import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format, parseISO, differenceInHours } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, Loader2, Calendar, Clock, Car, AlertCircle, X, Phone, MapPin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Reservation {
  id: string;
  confirmation_code: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  status: string;
  notes: string | null;
  car_size: string | null;
  service: {
    name: string;
    duration_minutes: number | null;
  };
  instance: {
    name: string;
    phone: string | null;
    address: string | null;
    logo_url: string | null;
    customer_edit_cutoff_hours: number | null;
    slug: string | null;
  };
}

const MojaRezerwacja = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReservation = async () => {
      if (!code) {
        setError('Brak kodu rezerwacji');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('reservations')
          .select(`
            id,
            confirmation_code,
            reservation_date,
            start_time,
            end_time,
            customer_name,
            customer_phone,
            vehicle_plate,
            status,
            notes,
            car_size,
            service:services(name, duration_minutes),
            instance:instances(name, phone, address, logo_url, customer_edit_cutoff_hours, slug)
          `)
          .eq('confirmation_code', code)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError('Nie znaleziono rezerwacji o podanym kodzie');
        } else {
          setReservation({
            ...data,
            service: data.service as unknown as Reservation['service'],
            instance: data.instance as unknown as Reservation['instance'],
          });
        }
      } catch (err) {
        console.error('Error fetching reservation:', err);
        setError('Wystąpił błąd podczas pobierania rezerwacji');
      } finally {
        setLoading(false);
      }
    };

    fetchReservation();
  }, [code]);

  const handleCancel = async () => {
    if (!reservation) return;

    setCancelling(true);
    try {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservation.id);

      if (updateError) throw updateError;

      setReservation({ ...reservation, status: 'cancelled' });
      toast({ title: 'Rezerwacja anulowana', description: 'Twoja rezerwacja została anulowana' });
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      toast({ title: 'Błąd', description: 'Nie udało się anulować rezerwacji', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { label: 'Potwierdzona', color: 'text-green-600 bg-green-500/10', icon: Check };
      case 'pending':
        return { label: 'Oczekująca', color: 'text-yellow-600 bg-yellow-500/10', icon: Clock };
      case 'cancelled':
        return { label: 'Anulowana', color: 'text-red-600 bg-red-500/10', icon: X };
      case 'completed':
        return { label: 'Zakończona', color: 'text-blue-600 bg-blue-500/10', icon: Check };
      case 'in_progress':
        return { label: 'W trakcie', color: 'text-primary bg-primary/10', icon: Clock };
      default:
        return { label: status, color: 'text-muted-foreground bg-muted', icon: Clock };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <>
        <Helmet>
          <title>Rezerwacja nie znaleziona - ARM CAR AUTO SPA</title>
        </Helmet>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
          <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold mb-2">{error || 'Nie znaleziono rezerwacji'}</h1>
          <p className="text-sm text-muted-foreground mb-6 text-center">
            Sprawdź kod w SMS-ie i spróbuj ponownie
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Zarezerwuj wizytę
          </Button>
        </div>
      </>
    );
  }

  const statusInfo = getStatusInfo(reservation.status);
  const StatusIcon = statusInfo.icon;
  const visitDateTime = new Date(`${reservation.reservation_date}T${reservation.start_time}`);
  const hoursBeforeVisit = differenceInHours(visitDateTime, new Date());
  const cutoffHours = reservation.instance.customer_edit_cutoff_hours ?? 1;
  const isPast = visitDateTime < new Date();
  const canEdit = ['confirmed', 'pending'].includes(reservation.status) && hoursBeforeVisit >= cutoffHours;
  const canCancel = ['confirmed', 'pending'].includes(reservation.status) && hoursBeforeVisit >= cutoffHours;

  return (
    <>
      <Helmet>
        <title>Moja rezerwacja - {reservation.instance.name}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container py-4 flex items-center gap-3">
            {reservation.instance.logo_url ? (
              <img src={reservation.instance.logo_url} alt={reservation.instance.name} className="h-10 w-auto" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Car className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="font-semibold text-foreground">{reservation.instance.name}</h1>
              {reservation.instance.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {reservation.instance.address}
                </p>
              )}
            </div>
          </div>
        </header>

        <main className="container py-6 max-w-md mx-auto">
          {/* Status badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${statusInfo.color}`}>
            <StatusIcon className="w-4 h-4" />
            {statusInfo.label}
          </div>

          {/* Reservation details */}
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Szczegóły rezerwacji</h2>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usługa</span>
                  <span className="font-medium text-foreground">{reservation.service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(parseISO(reservation.reservation_date), 'd MMMM yyyy', { locale: pl })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Godzina</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    {reservation.start_time.slice(0, 5)}
                  </span>
                </div>
                {reservation.service.duration_minutes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Czas trwania</span>
                    <span className="font-medium text-foreground">{reservation.service.duration_minutes} min</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kod potwierdzenia</span>
                  <span className="font-mono font-bold text-primary">{reservation.confirmation_code}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Twoje dane</h2>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Imię</span>
                  <span className="font-medium text-foreground">{reservation.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefon</span>
                  <span className="font-medium text-foreground">{reservation.customer_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pojazd</span>
                  <span className="font-medium text-foreground">{reservation.vehicle_plate}</span>
                </div>
                {reservation.car_size && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rozmiar</span>
                    <span className="font-medium text-foreground">
                      {reservation.car_size === 'small' ? 'Mały' : reservation.car_size === 'medium' ? 'Średni' : 'Duży'}
                    </span>
                  </div>
                )}
                {reservation.notes && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground text-xs">Uwagi:</span>
                    <p className="text-foreground mt-0.5">{reservation.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            {reservation.instance.phone && (
              <a
                href={`tel:${reservation.instance.phone}`}
                className="glass-card p-4 flex items-center gap-3 hover:border-primary/50 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Masz pytania?</p>
                  <p className="text-xs text-muted-foreground">Zadzwoń: {reservation.instance.phone}</p>
                </div>
              </a>
            )}

            {/* Actions */}
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300">
                    Anuluj rezerwację
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Anulować rezerwację?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Czy na pewno chcesz anulować rezerwację na {format(parseISO(reservation.reservation_date), 'd MMMM', { locale: pl })} o godzinie {reservation.start_time.slice(0, 5)}?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Nie</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Tak, anuluj
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground" 
              onClick={() => window.location.href = '/'}
            >
              Zarezerwuj kolejną wizytę
            </Button>
          </div>
        </main>
      </div>
    </>
  );
};

export default MojaRezerwacja;
