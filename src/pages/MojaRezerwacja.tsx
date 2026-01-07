import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { format, parseISO, differenceInHours } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, Loader2, Calendar, Clock, Car, AlertCircle, X, Phone, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
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
  customer_notes: string | null;
  car_size: string | null;
  service_id: string;
  station_id: string | null;
  instance_id: string;
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [pendingChangeRequest, setPendingChangeRequest] = useState<{
    id: string;
    reservation_date: string;
    start_time: string;
    confirmation_code: string;
    service?: { name: string };
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
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
            customer_notes,
            car_size,
            service_id,
            station_id,
            instance_id,
            service:services(name, duration_minutes),
            instance:instances(name, phone, address, logo_url, customer_edit_cutoff_hours, slug)
          `)
          .eq('confirmation_code', code)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError(t('errors.notFound'));
        } else {
          setReservation({
            ...data,
            service: data.service as unknown as Reservation['service'],
            instance: data.instance as unknown as Reservation['instance'],
          });
          
          // Check for pending change request linked to this reservation
          const { data: changeRequest } = await supabase
            .from('reservations')
            .select(`
              id,
              reservation_date,
              start_time,
              confirmation_code,
              service:services(name)
            `)
            .eq('original_reservation_id', data.id)
            .eq('status', 'change_requested')
            .maybeSingle();
          
          if (changeRequest) {
            setPendingChangeRequest({
              ...changeRequest,
              service: changeRequest.service as unknown as { name: string }
            });
          }
        }
      } catch (err) {
        console.error('Error fetching reservation:', err);
        setError(t('errors.generic'));
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
      // Use SECURITY DEFINER function to cancel reservation
      const { data: success, error: cancelError } = await supabase
        .rpc('cancel_reservation_by_code', { _confirmation_code: reservation.confirmation_code });

      if (cancelError) throw cancelError;
      if (!success) throw new Error('Failed to cancel reservation');

      // Send push notification to admin via edge function (handles notification creation too)
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            instanceId: reservation.instance_id,
            title: `❌ Anulowana: ${reservation.customer_name}`,
            body: `${reservation.service.name} - ${format(parseISO(reservation.reservation_date), 'd MMM', { locale: pl })} ${reservation.start_time.slice(0, 5)}`,
            url: `/admin?reservationCode=${reservation.confirmation_code}`
          }
        });
      } catch (pushError) {
        console.error('Push notification error:', pushError);
      }

      setReservation({ ...reservation, status: 'cancelled' });
      setCancelDialogOpen(false);
      toast({ title: t('myReservation.reservationCancelled') });
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      toast({ title: t('common.error'), description: t('errors.generic'), variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const navigateToEdit = () => {
    if (!reservation) return;
    
    const hostname = window.location.hostname;
    const isDevOrStaging = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.lovable.app');
    
    // In dev/staging mode, navigate to /rezerwacje
    // In production with subdomains, the slug is already in the subdomain
    const basePath = isDevOrStaging ? '/rezerwacje' : '/';
    
    navigate(basePath, { 
      state: { 
        editMode: true,
        existingReservation: {
          id: reservation.id,
          confirmation_code: reservation.confirmation_code,
          service_id: reservation.service_id,
          reservation_date: reservation.reservation_date,
          start_time: reservation.start_time,
          station_id: reservation.station_id,
          customer_name: reservation.customer_name,
          customer_phone: reservation.customer_phone,
          vehicle_plate: reservation.vehicle_plate,
          car_size: reservation.car_size,
          customer_notes: reservation.customer_notes,
          instance_id: reservation.instance_id
        }
      }
    });
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
  const canEdit = ['confirmed', 'pending'].includes(reservation.status) && hoursBeforeVisit >= cutoffHours && !pendingChangeRequest;
  const canCancel = ['confirmed', 'pending'].includes(reservation.status) && hoursBeforeVisit >= cutoffHours && !pendingChangeRequest;

  return (
    <>
      <Helmet>
        <title>Moja rezerwacja - {reservation.instance.name}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header - only logo and name */}
        <header className="border-b border-border bg-card">
          <div className="container py-4 flex items-center justify-center gap-3">
            {reservation.instance.logo_url ? (
              <img src={reservation.instance.logo_url} alt={reservation.instance.name} className="h-12 w-auto" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Car className="w-6 h-6 text-primary" />
              </div>
            )}
            <h1 className="font-semibold text-foreground text-lg">{reservation.instance.name}</h1>
          </div>
        </header>

        <main className="container py-6 max-w-md mx-auto flex-1 pb-40">
          {/* Status badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${statusInfo.color}`}>
            <StatusIcon className="w-4 h-4" />
            {statusInfo.label}
          </div>

          {/* Pending change request info */}
          {pendingChangeRequest && (
            <div className="glass-card p-4 mb-4 bg-orange-50 border-orange-200">
              <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
                <Clock className="w-4 h-4" />
                {t('myReservation.pendingChangeRequest')}
              </div>
              <div className="text-sm text-orange-600 space-y-1">
                <div className="flex justify-between">
                  <span>{t('myReservation.proposedNewDate')}</span>
                  <span className="font-medium">
                    {format(parseISO(pendingChangeRequest.reservation_date), 'd MMMM', { locale: pl })} o {pendingChangeRequest.start_time.slice(0, 5)}
                  </span>
                </div>
                {pendingChangeRequest.service?.name && (
                  <div className="flex justify-between">
                    <span>{t('reservations.service')}</span>
                    <span className="font-medium">{pendingChangeRequest.service.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
                  <span className="text-muted-foreground">Kod rezerwacji</span>
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
                {reservation.customer_notes && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground text-xs">Uwagi:</span>
                    <p className="text-foreground mt-0.5">{reservation.customer_notes}</p>
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
          </div>
        </main>

        {/* Fixed bottom actions */}
        {(canEdit || canCancel) && (
          <div className="fixed bottom-14 left-0 right-0 z-40 bg-background border-t border-border p-4">
            <div className="container max-w-md mx-auto flex gap-3">
              {canCancel && (
                <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="flex-1 h-12 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300">
                      Anuluj
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('myReservation.cancelDialog.title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('myReservation.cancelDialog.description', {
                          date: format(parseISO(reservation.reservation_date), 'd MMMM', { locale: pl }),
                          time: reservation.start_time.slice(0, 5)
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3 mt-4">
                      <Button 
                        variant="default"
                        onClick={() => {
                          setCancelDialogOpen(false);
                          navigateToEdit();
                        }}
                        className="w-full"
                      >
                        {t('myReservation.cancelDialog.findAnotherTime')}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="w-full text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {cancelling && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {t('myReservation.cancelDialog.confirmCancel')}
                      </Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('myReservation.cancelDialog.back')}</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              {canEdit && (
                <Button 
                  className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={navigateToEdit}
                >
                  Zmień
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Footer - always visible */}
        <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background">
          <div className="container py-3">
            <p className="text-sm text-muted-foreground text-center">
              <a href="https://n2wash.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">N2Wash.com</a> - System rezerwacji online
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default MojaRezerwacja;
