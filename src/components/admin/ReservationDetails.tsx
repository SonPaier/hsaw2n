import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { X, User, Phone, Car, Clock, Calendar, CheckCircle2, XCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_plate: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  station_id: string | null;
  status: string;
  confirmation_code: string;
  price?: number;
  notes?: string;
  service?: {
    name: string;
  };
  station?: {
    name: string;
  };
}

interface ReservationDetailsProps {
  reservation: Reservation | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (reservationId: string, newStatus: string) => void;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-success/20 text-success border-success/30">Potwierdzone</Badge>;
    case 'pending':
      return <Badge className="bg-warning/20 text-warning border-warning/30">Oczekujące</Badge>;
    case 'in_progress':
      return <Badge className="bg-primary/20 text-primary border-primary/30">W trakcie</Badge>;
    case 'completed':
      return <Badge className="bg-muted text-muted-foreground">Zakończone</Badge>;
    case 'cancelled':
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Anulowane</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const ReservationDetails = ({ reservation, open, onClose, onStatusChange }: ReservationDetailsProps) => {
  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Szczegóły rezerwacji</span>
            {getStatusBadge(reservation.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dane klienta
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{reservation.customer_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a 
                  href={`tel:${reservation.customer_phone}`}
                  className="text-primary hover:underline"
                >
                  {reservation.customer_phone}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Car className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground font-mono">{reservation.vehicle_plate}</span>
              </div>
            </div>
          </div>

          {/* Reservation Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Szczegóły wizyty
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">
                  {format(new Date(reservation.reservation_date), 'd MMMM yyyy (EEEE)', { locale: pl })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">
                  {reservation.start_time} - {reservation.end_time}
                </span>
              </div>
              {reservation.service && (
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4" />
                  <div>
                    <div className="text-foreground">{reservation.service.name}</div>
                    {reservation.price && (
                      <div className="text-sm text-muted-foreground">
                        {reservation.price.toFixed(2)} PLN
                      </div>
                    )}
                  </div>
                </div>
              )}
              {reservation.station && (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4" />
                  <span className="text-muted-foreground">
                    {reservation.station.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Code */}
          <div className="p-3 bg-secondary/50 rounded-lg text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Kod potwierdzenia
            </div>
            <div className="text-2xl font-mono font-bold text-primary">
              {reservation.confirmation_code}
            </div>
          </div>

          {/* Notes */}
          {reservation.notes && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Notatki
              </h3>
              <p className="text-sm text-foreground">{reservation.notes}</p>
            </div>
          )}

          {/* Actions */}
          {onStatusChange && reservation.status !== 'completed' && reservation.status !== 'cancelled' && (
            <div className="flex gap-2 pt-4 border-t border-border/50">
              {reservation.status === 'pending' && (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => onStatusChange(reservation.id, 'confirmed')}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Potwierdź
                </Button>
              )}
              {reservation.status === 'confirmed' && (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => onStatusChange(reservation.id, 'in_progress')}
                >
                  <PlayCircle className="w-4 h-4" />
                  Rozpocznij
                </Button>
              )}
              {reservation.status === 'in_progress' && (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => onStatusChange(reservation.id, 'completed')}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Zakończ
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2 text-destructive"
                onClick={() => onStatusChange(reservation.id, 'cancelled')}
              >
                <XCircle className="w-4 h-4" />
                Anuluj
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReservationDetails;
