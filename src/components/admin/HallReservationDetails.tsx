import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Car, Wrench, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Reservation {
  id: string;
  instance_id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  reservation_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  service?: {
    name: string;
  };
}

interface HallReservationDetailsProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (reservationId: string, newStatus: string) => void;
}

const HallReservationDetails = ({ 
  reservation, 
  open, 
  onOpenChange,
  onStatusChange 
}: HallReservationDetailsProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleCompleteVisit = async () => {
    if (!reservation) return;
    
    setIsLoading(true);
    try {
      // Update reservation status to completed
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'completed' })
        .eq('id', reservation.id);

      if (updateError) {
        toast.error('Błąd podczas aktualizacji statusu');
        console.error('Update error:', updateError);
        setIsLoading(false);
        return;
      }

      // Send SMS about visit completion
      const { error: smsError } = await supabase.functions.invoke('send-sms-message', {
        body: {
          phone: reservation.customer_phone,
          message: `Dziękujemy za wizytę! Twój samochód (${reservation.vehicle_plate}) jest gotowy do odbioru. Do zobaczenia!`,
          instanceId: reservation.instance_id
        }
      });

      if (smsError) {
        console.error('SMS error:', smsError);
        // Don't fail the operation if SMS fails
        toast.warning('Wizyta zakończona, ale SMS nie został wysłany');
      } else {
        toast.success('Wizyta zakończona, SMS wysłany do klienta');
      }

      onStatusChange?.(reservation.id, 'completed');
      onOpenChange(false);
    } catch (error) {
      console.error('Error completing visit:', error);
      toast.error('Wystąpił błąd');
    } finally {
      setIsLoading(false);
    }
  };

  if (!reservation) return null;

  const isMultiDay = reservation.end_date && reservation.end_date !== reservation.reservation_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Szczegóły wizyty</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Vehicle info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Car className="w-5 h-5 text-primary" />
            <div>
              <div className="font-semibold text-lg">{reservation.vehicle_plate}</div>
              <div className="text-sm text-muted-foreground">{reservation.customer_name}</div>
            </div>
          </div>

          {/* Service info */}
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Wrench className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Zakres usług</div>
              <div className="text-lg">{reservation.service?.name || 'Brak danych'}</div>
            </div>
          </div>

          {/* Time info */}
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Clock className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Termin</div>
              <div className="text-sm">
                {isMultiDay ? (
                  <>
                    {format(new Date(reservation.reservation_date), 'd MMM', { locale: pl })} {reservation.start_time}
                    {' - '}
                    {format(new Date(reservation.end_date!), 'd MMM', { locale: pl })} {reservation.end_time}
                  </>
                ) : (
                  <>
                    {format(new Date(reservation.reservation_date), 'd MMMM yyyy', { locale: pl })}
                    <br />
                    {reservation.start_time} - {reservation.end_time}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="text-center">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              reservation.status === 'completed' 
                ? 'bg-green-100 text-green-700' 
                : reservation.status === 'in_progress'
                ? 'bg-blue-100 text-blue-700'
                : reservation.status === 'confirmed'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {reservation.status === 'completed' && 'Zakończona'}
              {reservation.status === 'in_progress' && 'W trakcie'}
              {reservation.status === 'confirmed' && 'Potwierdzona'}
              {reservation.status === 'pending' && 'Oczekująca'}
            </span>
          </div>
        </div>

        {/* Complete visit button - only if not already completed */}
        {reservation.status !== 'completed' && reservation.status !== 'cancelled' && (
          <Button 
            onClick={handleCompleteVisit} 
            disabled={isLoading}
            className="w-full h-14 text-lg gap-2"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Wysyłanie...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Zakończ wizytę
              </>
            )}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HallReservationDetails;
