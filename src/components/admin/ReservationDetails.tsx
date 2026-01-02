import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Car, Clock, Save, Loader2, Trash2, Pencil, MessageSquare, PhoneCall, CalendarIcon, Check, CheckCircle2, ChevronDown, RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SendSmsDialog from '@/components/admin/SendSmsDialog';
import ServiceSelector from '@/components/admin/ServiceSelector';
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
  source?: string | null;
  service_id?: string;
  service_ids?: string[];
  service?: {
    name: string;
  };
  // Array of all services (if multi-service reservation)
  services_data?: Array<{
    name: string;
    shortcut?: string | null;
  }>;
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
  onConfirm?: (reservationId: string) => void;
  onStartWork?: (reservationId: string) => void;
  onEndWork?: (reservationId: string) => void;
  onRelease?: (reservationId: string) => void;
  onRevertToConfirmed?: (reservationId: string) => void;
}

// CAR_SIZE_LABELS moved inside component for i18n

// getSourceLabel moved inside component for i18n

// getStatusBadge moved inside component for i18n

const ReservationDetails = ({ reservation, open, onClose, onDelete, onSave, onConfirm, onStartWork, onEndWork, onRelease, onRevertToConfirmed }: ReservationDetailsProps) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startingWork, setStartingWork] = useState(false);
  const [endingWork, setEndingWork] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [inProgressDropdownOpen, setInProgressDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const CAR_SIZE_LABELS: Record<CarSize, string> = {
    small: t('reservations.carSizes.small'),
    medium: t('reservations.carSizes.medium'),
    large: t('reservations.carSizes.large'),
  };

  const getSourceLabel = (source?: string | null) => {
    if (!source || source === 'admin') {
      return <Badge variant="outline" className="text-xs font-normal">{t('reservations.addedBy')}: {t('reservations.sources.employee')}</Badge>;
    }
    if (source === 'customer' || source === 'calendar' || source === 'online') {
      return <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary">{t('reservations.addedBy')}: {t('reservations.sources.system')}</Badge>;
    }
    if (source === 'booksy') {
      return <Badge variant="outline" className="text-xs font-normal border-purple-500/30 text-purple-600">{t('reservations.addedBy')}: {t('reservations.sources.booksy')}</Badge>;
    }
    return <Badge variant="outline" className="text-xs font-normal">{t('reservations.addedBy')}: {source}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-success/20 text-success border-success/30">{t('reservations.statuses.confirmed')}</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">{t('reservations.statuses.pending')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-primary/20 text-primary border-primary/30">{t('reservations.statuses.inProgress')}</Badge>;
      case 'completed':
        return <Badge className="bg-muted text-muted-foreground">{t('reservations.statuses.completed')}</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{t('reservations.statuses.cancelled')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

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
      // Initialize service IDs from reservation
      const serviceIds = reservation.service_ids || (reservation.service_id ? [reservation.service_id] : []);
      setSelectedServiceIds(serviceIds);
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
        service_ids: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
        service_id: selectedServiceIds[0] || reservation.service_id,
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
      const serviceIds = reservation.service_ids || (reservation.service_id ? [reservation.service_id] : []);
      setSelectedServiceIds(serviceIds);
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
          <DialogTitle className="text-xl">
            {isEditing ? t('reservations.editReservation') : (
              <span className="flex items-center gap-3">
                <span>{formatTime(startTime)} - {formatTime(endTime)}</span>
                <span className="text-muted-foreground font-normal">•</span>
                <span className="font-normal">{format(new Date(reservation.reservation_date), 'd MMMM yyyy', { locale: pl })}</span>
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {getStatusBadge(reservation.status)}
            {getSourceLabel(reservation.source)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing ? (
            <>
              {/* Customer Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {t('common.name')}
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
                  {t('common.phone')}
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
                  {t('reservations.carModel')}
                </Label>
                <Input
                  id="edit-car"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                />
              </div>

              {/* Car Size */}
              <div className="space-y-2">
                <Label>{t('reservations.carSize')}</Label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as CarSize[]).map((size) => (
                    <Button
                      key={size}
                      type="button"
                      variant={carSize === size ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setCarSize(size)}
                    >
                      {CAR_SIZE_LABELS[size]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Service editing - show all services with ability to toggle them */}
              <ServiceSelector
                instanceId={reservation.instance_id}
                selectedServiceIds={selectedServiceIds}
                onServicesChange={setSelectedServiceIds}
              />

              {/* Date - Range for PPF, Single for others */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {isPPFStation ? t('reservations.datesRange') : t('reservations.date')}
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
                        ) : t('reservations.selectDates')
                      ) : (
                        reservationDate ? format(new Date(reservationDate), 'd MMMM yyyy', { locale: pl }) : t('reservations.selectDate')
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
                    {isPPFStation && endDate && endDate !== reservationDate ? `${t('reservations.start')} (${format(new Date(reservationDate), 'd.MM', { locale: pl })})` : t('reservations.start')}
                  </Label>
                  <Input
                    id="edit-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {isPPFStation && endDate && endDate !== reservationDate ? `${t('reservations.end')} (${format(new Date(endDate), 'd.MM', { locale: pl })})` : t('reservations.end')}
                  </Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>


              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t('common.notes')}</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('reservations.additionalNotes')}
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
                  {t('common.cancel')}
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
                  {t('common.save')}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Read-only view - simplified layout */}
              <div className="space-y-4">
                {/* Customer info row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">{t('reservations.customer')}</div>
                      <div className="font-medium">{customerName}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={handleCall}
                      title={t('common.call')}
                    >
                      <PhoneCall className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={handleSMS}
                      title={t('common.sendSms')}
                    >
                      <MessageSquare className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">{t('common.phone')}</div>
                    <div className="font-medium">{customerPhone}</div>
                  </div>
                </div>

                {/* Car model + size */}
                {carModel && (
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">{t('reservations.car')}</div>
                      <div className="font-medium">{carModel}</div>
                    </div>
                  </div>
                )}

                {/* Car size warning if missing */}
                {!carSize && reservation.status === 'pending' && (
                  <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
                    <Car className="w-4 h-4 shrink-0" />
                    <span>{t('reservations.carSizeRequiredWarning')}</span>
                  </div>
                )}

                {/* Service - show all services if multi-service */}
                {(reservation.services_data && reservation.services_data.length > 0) || reservation.service ? (
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center text-primary font-bold text-sm mt-1">U</div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('reservations.services')}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {reservation.services_data && reservation.services_data.length > 0 ? (
                          reservation.services_data.map((svc, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-700/90 text-white rounded text-xs font-medium">
                              {svc.name}
                            </span>
                          ))
                        ) : reservation.service ? (
                          <span className="px-2 py-0.5 bg-slate-700/90 text-white rounded text-xs font-medium">
                            {reservation.service.name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Notes - always visible if present */}
                {notes && (
                  <div className="border-t border-border/30 pt-3">
                    <div className="text-xs text-muted-foreground mb-1">{t('common.notes')}</div>
                    <div className="text-sm whitespace-pre-wrap">{notes}</div>
                  </div>
                )}

                {/* Suggested price (only label change) */}
                {price && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="w-5 h-5 flex items-center justify-center font-bold text-sm">zł</div>
                    <div>
                      <div className="text-xs">{t('reservations.suggestedPrice')}</div>
                      <div className="font-medium">{price} PLN</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
                {/* Row 1: Edit and Delete for confirmed only (pending uses reject) */}
                {reservation.status === 'confirmed' && (
                  <div className="flex gap-2">
                    {onSave && (
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="w-4 h-4" />
                        {t('common.edit')}
                      </Button>
                    )}
                    
                    {onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={deleting}
                          >
                            {deleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            {t('common.delete')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('reservations.confirmDeleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('reservations.confirmDeleteDescription', { name: customerName, phone: customerPhone })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.no')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {t('reservations.yesDelete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}

                {/* Pending: Edit and Reject/Confirm actions */}
                {reservation.status === 'pending' && (
                  <div className="flex gap-2">
                    {onSave && (
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="w-4 h-4" />
                        {t('common.edit')}
                      </Button>
                    )}
                  </div>
                )}

                {/* Row 2: Status-specific primary actions */}
                {/* Pending: Reject and Confirm */}
                {reservation.status === 'pending' && (
                  <div className="flex gap-2">
                    {onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={deleting}
                          >
                            {deleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            {t('reservations.reject')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('reservations.confirmRejectTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('reservations.confirmRejectDescription', { name: customerName, phone: customerPhone })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.no')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {t('reservations.yesReject')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    
                    {onConfirm && (
                      <Button 
                        className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
                        onClick={async () => {
                          if (!carSize) {
                            setIsEditing(true);
                            return;
                          }
                          setConfirming(true);
                          try {
                            await onConfirm(reservation.id);
                          } finally {
                            setConfirming(false);
                          }
                        }}
                        disabled={confirming}
                      >
                        {confirming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {t('common.confirm')}
                      </Button>
                    )}
                  </div>
                )}

                {/* Confirmed: Start Work */}
                {reservation.status === 'confirmed' && onStartWork && (
                  <Button 
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={async () => {
                      setStartingWork(true);
                      try {
                        await onStartWork(reservation.id);
                      } finally {
                        setStartingWork(false);
                      }
                    }}
                    disabled={startingWork}
                  >
                    {startingWork ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                    {t('reservations.startWork')}
                  </Button>
                )}

                {/* In Progress: End Work with dropdown for revert */}
                {reservation.status === 'in_progress' && onEndWork && (
                  <div className="flex gap-0">
                    <Button 
                      className="flex-1 gap-2 bg-sky-500 hover:bg-sky-600 text-white rounded-r-none"
                      onClick={async () => {
                        setEndingWork(true);
                        try {
                          await onEndWork(reservation.id);
                        } finally {
                          setEndingWork(false);
                        }
                      }}
                      disabled={endingWork || reverting}
                    >
                      {endingWork ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {t('reservations.endWork')}
                    </Button>
                    
                    {onRevertToConfirmed && (
                      <Popover open={inProgressDropdownOpen} onOpenChange={setInProgressDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            className="px-2 bg-sky-500 hover:bg-sky-600 text-white rounded-l-none border-l border-sky-400"
                            disabled={endingWork || reverting}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1 bg-background border shadow-lg z-50" align="end">
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-sm"
                            onClick={async () => {
                              setInProgressDropdownOpen(false);
                              setReverting(true);
                              try {
                                await onRevertToConfirmed(reservation.id);
                              } finally {
                                setReverting(false);
                              }
                            }}
                            disabled={reverting}
                          >
                            {reverting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                            {t('reservations.revertToConfirmed')}
                          </Button>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                )}

                {/* Completed: Release Vehicle */}
                {reservation.status === 'completed' && onRelease && (
                  <Button 
                    className="w-full gap-2"
                    variant="outline"
                    onClick={async () => {
                      setReleasing(true);
                      try {
                        await onRelease(reservation.id);
                      } finally {
                        setReleasing(false);
                      }
                    }}
                    disabled={releasing}
                  >
                    {releasing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Car className="w-4 h-4" />
                    )}
                    {t('reservations.releaseVehicle')}
                  </Button>
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
