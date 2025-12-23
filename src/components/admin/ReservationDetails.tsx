import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Car, Clock, CheckCircle2, XCircle, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CarSize = 'small' | 'medium' | 'large';

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_plate: string;
  car_size?: CarSize | null;
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
  onSave?: (reservationId: string, data: Partial<Reservation>) => void;
}

const CAR_SIZE_LABELS: Record<CarSize, string> = {
  small: 'Mały',
  medium: 'Średni',
  large: 'Duży',
};

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

const ReservationDetails = ({ reservation, open, onClose, onStatusChange, onSave }: ReservationDetailsProps) => {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Editable fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');

  // Reset form when reservation changes
  useEffect(() => {
    if (reservation) {
      setCustomerName(reservation.customer_name || '');
      setCustomerPhone(reservation.customer_phone || '');
      setCarModel(reservation.vehicle_plate || '');
      setCarSize(reservation.car_size || '');
      setStartTime(reservation.start_time || '');
      setEndTime(reservation.end_time || '');
      setNotes(reservation.notes || '');
      setPrice(reservation.price?.toString() || '');
      setHasChanges(false);
    }
  }, [reservation]);

  const handleFieldChange = (setter: (value: any) => void, value: any) => {
    setter(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!reservation || !onSave) return;
    
    setSaving(true);
    try {
      await onSave(reservation.id, {
        customer_name: customerName,
        customer_phone: customerPhone,
        vehicle_plate: carModel,
        car_size: carSize || null,
        start_time: startTime,
        end_time: endTime,
        notes: notes || undefined,
        price: price ? parseFloat(price) : undefined,
      });
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edytuj rezerwację</span>
            {getStatusBadge(reservation.status)}
          </DialogTitle>
          <DialogDescription>
            {format(new Date(reservation.reservation_date), 'd MMMM yyyy (EEEE)', { locale: pl })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Imię i nazwisko
            </Label>
            <Input
              id="edit-name"
              value={customerName}
              onChange={(e) => handleFieldChange(setCustomerName, e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="edit-phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Telefon
            </Label>
            <Input
              id="edit-phone"
              value={customerPhone}
              onChange={(e) => handleFieldChange(setCustomerPhone, e.target.value)}
            />
          </div>

          {/* Car Model */}
          <div className="space-y-2">
            <Label htmlFor="edit-car" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              Model samochodu
            </Label>
            <Input
              id="edit-car"
              value={carModel}
              onChange={(e) => handleFieldChange(setCarModel, e.target.value)}
            />
          </div>

          {/* Car Size */}
          <div className="space-y-2">
            <Label>Wielkość samochodu</Label>
            <Select 
              value={carSize} 
              onValueChange={(v) => handleFieldChange(setCarSize, v as CarSize)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz wielkość" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="small">{CAR_SIZE_LABELS.small}</SelectItem>
                <SelectItem value="medium">{CAR_SIZE_LABELS.medium}</SelectItem>
                <SelectItem value="large">{CAR_SIZE_LABELS.large}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service (read-only) */}
          {reservation.service && (
            <div className="space-y-2">
              <Label>Usługa</Label>
              <div className="p-2 bg-muted/50 rounded-md text-sm">
                {reservation.service.name}
              </div>
            </div>
          )}

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Początek
              </Label>
              <Input
                id="edit-start"
                type="time"
                value={startTime}
                onChange={(e) => handleFieldChange(setStartTime, e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">Koniec</Label>
              <Input
                id="edit-end"
                type="time"
                value={endTime}
                onChange={(e) => handleFieldChange(setEndTime, e.target.value)}
              />
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="edit-price">Cena (PLN)</Label>
            <Input
              id="edit-price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => handleFieldChange(setPrice, e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notatki</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => handleFieldChange(setNotes, e.target.value)}
              placeholder="Dodatkowe uwagi..."
              rows={3}
            />
          </div>

          {/* Save Button */}
          {onSave && hasChanges && (
            <Button 
              className="w-full gap-2" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Zapisz zmiany
            </Button>
          )}

          {/* Status Actions */}
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
