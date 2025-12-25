import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Car, Clock, Save, Loader2, Trash2, Pencil, MessageSquare, PhoneCall, CalendarIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SendSmsDialog from '@/components/admin/SendSmsDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { DateRange } from 'react-day-picker';

type CarSize = 'small' | 'medium' | 'large';

interface Reservation {
  id: string;
  instance_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_plate: string;
  car_size?: CarSize | null;
  reservation_date: string;
  end_date?: string | null;
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
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
}

interface ReservationDetailsProps {
  reservation: Reservation | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (reservationId: string, customerData: { name: string; phone: string; email?: string; instance_id: string }) => void;
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

const ReservationDetails = ({ reservation, open, onClose, onDelete, onSave }: ReservationDetailsProps) => {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Editable fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
  const [reservationDate, setReservationDate] = useState('');
  const [endDate, setEndDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');

  // Check if station type is PPF (folia) for multi-day reservations
  const isPPFStation = reservation?.station?.type === 'ppf';

  // Reset form when reservation changes
  useEffect(() => {
    if (reservation) {
      setCustomerName(reservation.customer_name || '');
      setCustomerPhone(reservation.customer_phone || '');
      setCarModel(reservation.vehicle_plate || '');
      setCarSize(reservation.car_size || '');
      setReservationDate(reservation.reservation_date || '');
      setEndDate(reservation.end_date || null);
      setStartTime(reservation.start_time || '');
      setEndTime(reservation.end_time || '');
      setNotes(reservation.notes || '');
      setPrice(reservation.price?.toString() || '');
      setIsEditing(false);
      setDatePickerOpen(false);
    }
  }, [reservation]);

  const handleSave = async () => {
    if (!reservation || !onSave) return;
    
    setSaving(true);
    try {
      await onSave(reservation.id, {
        customer_name: customerName,
        customer_phone: customerPhone,
        vehicle_plate: carModel,
        car_size: carSize || null,
        reservation_date: reservationDate,
        end_date: isPPFStation ? (endDate || reservationDate) : reservationDate,
        start_time: startTime,
        end_time: endTime,
        notes: notes || undefined,
        price: price ? parseFloat(price) : undefined,
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!reservation || !onDelete) return;
    
    setDeleting(true);
    try {
      await onDelete(reservation.id, {
        name: customerName,
        phone: customerPhone,
        email: reservation.customer_email,
        instance_id: reservation.instance_id,
      });
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleCall = () => {
    if (customerPhone) {
      window.location.href = `tel:${customerPhone}`;
    }
  };

  const handleSMS = () => {
    if (customerPhone) {
      if (isMobile) {
        window.location.href = `sms:${customerPhone}`;
      } else {
        setSmsDialogOpen(true);
      }
    }
  };

  const handleCancelEdit = () => {
    if (reservation) {
      setCustomerName(reservation.customer_name || '');
      setCustomerPhone(reservation.customer_phone || '');
      setCarModel(reservation.vehicle_plate || '');
      setCarSize(reservation.car_size || '');
      setReservationDate(reservation.reservation_date || '');
      setEndDate(reservation.end_date || null);
      setStartTime(reservation.start_time || '');
      setEndTime(reservation.end_time || '');
      setNotes(reservation.notes || '');
      setPrice(reservation.price?.toString() || '');
    }
    setIsEditing(false);
  };

  if (!reservation) return null;

  const formatTime = (time: string) => {
    return time?.substring(0, 5) || '';
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <span>{isEditing ? 'Edytuj rezerwację' : 'Szczegóły rezerwacji'}</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!isEditing && onSave && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-3 h-3" />
                  Edytuj
                </Button>
              )}
            </div>
          </div>
          <DialogDescription>
            {format(new Date(reservation.reservation_date), 'd MMMM yyyy (EEEE)', { locale: pl })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing ? (
            <>
              {/* Customer Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Imię i nazwisko
                </Label>
                <Input
                  id="edit-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
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
                  onChange={(e) => setCustomerPhone(e.target.value)}
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
                  onChange={(e) => setCarModel(e.target.value)}
                />
              </div>

              {/* Car Size */}
              <div className="space-y-2">
                <Label>Wielkość samochodu</Label>
                <Select 
                  value={carSize} 
                  onValueChange={(v) => setCarSize(v as CarSize)}
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

              {/* Date - Range for PPF, Single for others */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {isPPFStation ? 'Daty rezerwacji (od - do)' : 'Data rezerwacji'}
                </Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !reservationDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {isPPFStation ? (
                        reservationDate ? (
                          endDate && endDate !== reservationDate ? (
                            `${format(new Date(reservationDate), 'd MMM', { locale: pl })} - ${format(new Date(endDate), 'd MMM yyyy', { locale: pl })}`
                          ) : (
                            format(new Date(reservationDate), 'd MMMM yyyy', { locale: pl })
                          )
                        ) : 'Wybierz daty'
                      ) : (
                        reservationDate ? format(new Date(reservationDate), 'd MMMM yyyy', { locale: pl }) : 'Wybierz datę'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {isPPFStation ? (
                      <Calendar
                        mode="range"
                        selected={{
                          from: reservationDate ? new Date(reservationDate) : undefined,
                          to: endDate ? new Date(endDate) : (reservationDate ? new Date(reservationDate) : undefined),
                        }}
                        onSelect={(range: DateRange | undefined) => {
                          if (range?.from) {
                            setReservationDate(format(range.from, 'yyyy-MM-dd'));
                            if (range.to) {
                              setEndDate(format(range.to, 'yyyy-MM-dd'));
                              setDatePickerOpen(false);
                            } else {
                              setEndDate(null);
                            }
                          }
                        }}
                        initialFocus
                        className="pointer-events-auto"
                        locale={pl}
                        numberOfMonths={1}
                      />
                    ) : (
                      <Calendar
                        mode="single"
                        selected={reservationDate ? new Date(reservationDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setReservationDate(format(date, 'yyyy-MM-dd'));
                            setEndDate(null);
                            setDatePickerOpen(false);
                          }
                        }}
                        initialFocus
                        className="pointer-events-auto"
                        locale={pl}
                      />
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {isPPFStation && endDate && endDate !== reservationDate ? `Początek (${format(new Date(reservationDate), 'd.MM', { locale: pl })})` : 'Początek'}
                  </Label>
                  <Input
                    id="edit-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">
                    {isPPFStation && endDate && endDate !== reservationDate ? `Koniec (${format(new Date(endDate), 'd.MM', { locale: pl })})` : 'Koniec'}
                  </Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
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
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notatki</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dodatkowe uwagi..."
                  rows={3}
                />
              </div>

              {/* Edit Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-border/50">
                <Button 
                  variant="outline"
                  className="flex-1" 
                  onClick={handleCancelEdit}
                >
                  Anuluj
                </Button>
                <Button 
                  className="flex-1 gap-2" 
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Zapisz
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Read-only view */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Klient</div>
                    <div className="font-medium">{customerName}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Telefon</div>
                    <div className="font-medium">{customerPhone}</div>
                  </div>
                </div>

                {carModel && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Car className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Samochód</div>
                      <div className="font-medium">
                        {carModel}
                        {carSize && <span className="text-muted-foreground ml-2">({CAR_SIZE_LABELS[carSize as CarSize]})</span>}
                      </div>
                    </div>
                  </div>
                )}

                {reservation.service && (
                  <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                    <div className="w-5 h-5 flex items-center justify-center text-primary font-bold text-sm">U</div>
                    <div>
                      <div className="text-xs text-muted-foreground">Usługa</div>
                      <div className="font-medium text-primary">{reservation.service.name}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Godzina</div>
                    <div className="font-medium">{formatTime(startTime)} - {formatTime(endTime)}</div>
                  </div>
                </div>

                {price && (
                  <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg">
                    <div className="w-5 h-5 flex items-center justify-center text-success font-bold text-sm">zł</div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cena</div>
                      <div className="font-medium text-success">{price} PLN</div>
                    </div>
                  </div>
                )}

                {notes && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Notatki</div>
                    <div className="text-sm">{notes}</div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Kod potwierdzenia: <span className="font-mono font-medium">{reservation.confirmation_code}</span>
                </div>
              </div>

              {/* Contact & Delete Buttons */}
              <div className="space-y-2 pt-4 border-t border-border/50">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={handleCall}
                  >
                    <PhoneCall className="w-4 h-4" />
                    Zadzwoń
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={handleSMS}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Wyślij SMS
                  </Button>
                </div>
                
                {onDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deleting}
                      >
                        {deleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Anuluj rezerwację
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Czy na pewno chcesz anulować rezerwację?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Rezerwacja zostanie usunięta z systemu. Dane klienta ({customerName}, {customerPhone}) zostaną zachowane w bazie klientów.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Nie, wróć</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Tak, usuń rezerwację
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    
    <SendSmsDialog
      phone={customerPhone}
      customerName={customerName}
      instanceId={reservation?.instance_id || null}
      open={smsDialogOpen}
      onClose={() => setSmsDialogOpen(false)}
    />
  </>
  );
};

export default ReservationDetails;
