import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Car, Clock, Loader2, Trash2, Pencil, MessageSquare, PhoneCall, Check, CheckCircle2, ChevronDown, ChevronUp, RotateCcw, X, Receipt } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SendSmsDialog from '@/components/admin/SendSmsDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
  customer_notes?: string | null;
  admin_notes?: string | null;
  source?: string | null;
  service_id?: string;
  service_ids?: string[];
  service?: {
    name: string;
  };
  services_data?: Array<{
    name: string;
    shortcut?: string | null;
    price_small?: number | null;
    price_medium?: number | null;
    price_large?: number | null;
    price_from?: number | null;
  }>;
  station?: {
    name: string;
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
  original_reservation_id?: string | null;
  original_reservation?: {
    reservation_date: string;
    start_time: string;
    confirmation_code: string;
  } | null;
  created_by?: string | null;
  created_by_username?: string | null;
  confirmation_sms_sent_at?: string | null;
  pickup_sms_sent_at?: string | null;
}

export interface HallVisibleFields {
  customer_name: boolean;
  customer_phone: boolean;
  vehicle_plate: boolean;
  services: boolean;
  admin_notes: boolean;
}

export interface HallAllowedActions {
  add_services: boolean;
  change_time: boolean;
  change_station: boolean;
  edit_reservation: boolean;
  delete_reservation: boolean;
}

export interface HallConfig {
  visible_fields: HallVisibleFields;
  allowed_actions: HallAllowedActions;
}

interface ReservationDetailsDrawerProps {
  reservation: Reservation | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (reservationId: string, customerData: { name: string; phone: string; email?: string; instance_id: string }) => void;
  onEdit?: (reservation: Reservation) => void;
  onNoShow?: (reservationId: string) => void;
  onConfirm?: (reservationId: string) => void;
  onStartWork?: (reservationId: string) => void;
  onEndWork?: (reservationId: string) => void;
  onRelease?: (reservationId: string) => void;
  onRevertToConfirmed?: (reservationId: string) => void;
  onRevertToInProgress?: (reservationId: string) => void;
  onApproveChangeRequest?: (reservationId: string) => void;
  onRejectChangeRequest?: (reservationId: string) => void;
  onSendPickupSms?: (reservationId: string) => Promise<void>;
  onSendConfirmationSms?: (reservationId: string) => Promise<void>;
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>;
  // Hall mode props
  mode?: 'admin' | 'hall';
  hallConfig?: HallConfig;
}

const ReservationDetailsDrawer = ({ 
  reservation, 
  open, 
  onClose, 
  onDelete, 
  onEdit, 
  onNoShow,
  onConfirm, 
  onStartWork, 
  onEndWork, 
  onRelease, 
  onRevertToConfirmed, 
  onRevertToInProgress,
  onApproveChangeRequest,
  onRejectChangeRequest,
  onSendPickupSms,
  onSendConfirmationSms,
  onStatusChange,
  mode = 'admin',
  hallConfig
}: ReservationDetailsDrawerProps) => {
  const isHallMode = mode === 'hall';
  const visibleFields = hallConfig?.visible_fields;
  const allowedActions = hallConfig?.allowed_actions;
  
  // In hall mode, check allowed_actions for edit/delete visibility
  const canEditInHallMode = isHallMode && allowedActions?.edit_reservation;
  const canDeleteInHallMode = isHallMode && allowedActions?.delete_reservation;
  const showEdit = !isHallMode || canEditInHallMode;
  const showDelete = !isHallMode || canDeleteInHallMode;
  
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [markingNoShow, setMarkingNoShow] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startingWork, setStartingWork] = useState(false);
  const [endingWork, setEndingWork] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [approvingChange, setApprovingChange] = useState(false);
  const [rejectingChange, setRejectingChange] = useState(false);
  const [inProgressDropdownOpen, setInProgressDropdownOpen] = useState(false);
  const [completedDropdownOpen, setCompletedDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [releasedDropdownOpen, setReleasedDropdownOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [sendingPickupSms, setSendingPickupSms] = useState(false);
  const [sendingConfirmationSms, setSendingConfirmationSms] = useState(false);
  const [priceDetailsOpen, setPriceDetailsOpen] = useState(false);
  const isMobile = useIsMobile();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [price, setPrice] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (reservation) {
      setCustomerName(reservation.customer_name || '');
      setCustomerPhone(reservation.customer_phone || '');
      setCarModel(reservation.vehicle_plate || '');
      setCarSize(reservation.car_size || '');
      setCustomerNotes(reservation.customer_notes || '');
      setAdminNotes(reservation.admin_notes || '');
      setPrice(reservation.price?.toString() || '');
      setStartTime(reservation.start_time || '');
      setEndTime(reservation.end_time || '');
    }
  }, [reservation]);

  const getSourceLabel = (source?: string | null, createdByUsername?: string | null) => {
    if (!source || source === 'admin') {
      const displayName = createdByUsername || t('reservations.sources.employee');
      return <Badge variant="outline" className="text-xs font-normal">{t('reservations.addedBy')}: {displayName}</Badge>;
    }
    if (source === 'customer' || source === 'calendar' || source === 'online') {
      return <Badge variant="outline" className="text-xs font-normal border-muted-foreground/30 text-muted-foreground">{t('reservations.addedBy')}: {t('reservations.sources.system')}</Badge>;
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
      case 'released':
        return <Badge className="bg-muted text-muted-foreground">{t('reservations.statuses.released')}</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{t('reservations.statuses.cancelled')}</Badge>;
      case 'no_show':
        return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">{t('reservations.statuses.noShow')}</Badge>;
      case 'change_requested':
        return <Badge className="bg-orange-200 text-orange-800 border-orange-400">{t('reservations.statuses.changeRequested')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleEdit = () => {
    if (!reservation || !onEdit) return;
    onEdit(reservation);
    onClose();
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
      setDeleteDialogOpen(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleNoShow = async () => {
    if (!reservation || !onNoShow) return;
    
    setMarkingNoShow(true);
    try {
      await onNoShow(reservation.id);
      setDeleteDialogOpen(false);
      onClose();
    } finally {
      setMarkingNoShow(false);
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

  if (!reservation) return null;

  const formatTime = (time: string) => {
    return time?.substring(0, 5) || '';
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose} modal={false}>
        <SheetContent 
          side="right" 
          className="sm:max-w-lg w-full flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.2)]"
          hideCloseButton
          hideOverlay
          // Keep drawer open; allow clicking calendar behind
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Header with time/date and X button */}
          <SheetHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-xl flex items-center gap-3">
                  <span>{formatTime(startTime)} - {formatTime(endTime)}</span>
                  <span className="text-muted-foreground font-normal">•</span>
                  <span className="font-normal">{format(new Date(reservation.reservation_date), 'd MMMM yyyy', { locale: pl })}</span>
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-2">
                  {getStatusBadge(reservation.status)}
                  {getSourceLabel(reservation.source, reservation.created_by_username)}
                </SheetDescription>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors -mt-1 -mr-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </SheetHeader>

          {/* Content area - scrollable */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Customer info row - hide in hall mode if not configured */}
            {(!isHallMode || visibleFields?.customer_name) && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">{t('reservations.customer')}</div>
                    <div className="font-medium">{customerName}</div>
                  </div>
                </div>
                {/* Contact buttons - hide in hall mode if phone not visible */}
                {(!isHallMode || visibleFields?.customer_phone) && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={handleCall}
                      title={t('common.call')}
                    >
                      <PhoneCall className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={handleSMS}
                      title={t('common.sendSms')}
                    >
                      <MessageSquare className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Phone - hide in hall mode if not configured */}
            {(!isHallMode || visibleFields?.customer_phone) && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.phone')}</div>
                  <div className="font-medium">{customerPhone}</div>
                </div>
              </div>
            )}

            {/* Reservation code - hide in hall mode */}
            {!isHallMode && reservation.confirmation_code && (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold text-xs">#</div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('reservations.reservationCode')}</div>
                  <div className="font-mono font-bold text-primary">{reservation.confirmation_code}</div>
                </div>
              </div>
            )}

            {/* Car model - vehicle_plate is always visible */}
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

            {/* Services */}
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

            {/* Kwota (Price) section with expandable receipt */}
            {(() => {
              // Calculate total from services based on car size
              const getServicePrice = (svc: { price_small?: number | null; price_medium?: number | null; price_large?: number | null; price_from?: number | null }) => {
                if (carSize === 'small' && svc.price_small) return svc.price_small;
                if (carSize === 'medium' && svc.price_medium) return svc.price_medium;
                if (carSize === 'large' && svc.price_large) return svc.price_large;
                return svc.price_from || 0;
              };

              const servicesWithPrices = reservation.services_data?.map(svc => ({
                name: svc.name,
                price: getServicePrice(svc)
              })) || [];

              const calculatedTotal = servicesWithPrices.reduce((sum, svc) => sum + svc.price, 0);
              const displayTotal = price ? parseFloat(price) : calculatedTotal;

              if (displayTotal <= 0 && servicesWithPrices.length === 0) return null;

              const hasMultipleServices = servicesWithPrices.length > 1;

              return (
                <div className="flex items-start gap-3">
                  <Receipt className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{t('addReservation.amount')}</div>
                    <div className="font-semibold text-lg">{displayTotal} zł</div>
                    
                    {hasMultipleServices && (
                      <button 
                        onClick={() => setPriceDetailsOpen(!priceDetailsOpen)}
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        {priceDetailsOpen ? t('common.hide') : t('addReservation.seeDetails')}
                        {priceDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                    
                    {priceDetailsOpen && hasMultipleServices && (
                      <ul className="mt-3 space-y-1">
                        {servicesWithPrices.map((svc, idx) => (
                          <li key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{svc.name}</span>
                            <span className="font-medium">{svc.price} zł</span>
                          </li>
                        ))}
                        <li className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-semibold">
                          <span>{t('common.total')}</span>
                          <span>{calculatedTotal} zł</span>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Customer Notes - hide in hall mode if notes not configured */}
            {(!isHallMode || visibleFields?.admin_notes) && customerNotes && (
              <div className="border-t border-border/30 pt-3">
                <div className="text-xs text-muted-foreground mb-1">{t('reservations.customerNotes')}</div>
                <div className="text-sm whitespace-pre-wrap bg-blue-50 dark:bg-blue-950/30 p-2 rounded">{customerNotes}</div>
              </div>
            )}

            {/* Admin Notes - hide in hall mode if notes not configured */}
            {(!isHallMode || visibleFields?.admin_notes) && (
              <div className="border-t border-border/30 pt-3">
                <div className="text-xs text-muted-foreground mb-1">{t('reservations.adminNotes')}</div>
                <div className="text-sm whitespace-pre-wrap">
                  {adminNotes || <span className="text-muted-foreground italic">Brak notatek wewnętrznych</span>}
                </div>
              </div>
            )}

            {/* Change request info - show original reservation reference */}
            {reservation.status === 'change_requested' && reservation.original_reservation && (
              <div className="border-t border-border/30 pt-3 mt-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
                    <RotateCcw className="w-4 h-4" />
                    {t('myReservation.changeRequestFrom')}
                  </div>
                  <div className="text-sm text-orange-600 space-y-1">
                    <div className="flex justify-between">
                      <span>{t('common.date')}</span>
                      <span className="font-medium">
                        {format(new Date(reservation.original_reservation.reservation_date), 'd MMMM yyyy', { locale: pl })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('common.time')}</span>
                      <span className="font-medium">
                        {reservation.original_reservation.start_time?.substring(0, 5)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('reservations.reservationCode')}</span>
                      <span className="font-mono font-bold text-orange-700">
                        {reservation.original_reservation.confirmation_code}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer with actions - pinned at bottom */}
          <div className="flex-shrink-0 border-t pt-4 space-y-2">
            {/* Change requested: Approve and Reject actions */}
            {reservation.status === 'change_requested' && (
              <div className="flex gap-2">
                {onRejectChangeRequest && (
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={async () => {
                      setRejectingChange(true);
                      try {
                        await onRejectChangeRequest(reservation.id);
                        onClose();
                      } finally {
                        setRejectingChange(false);
                      }
                    }}
                    disabled={rejectingChange || approvingChange}
                  >
                    {rejectingChange ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {t('myReservation.rejectChange')}
                  </Button>
                )}
                
                {onApproveChangeRequest && (
                  <Button 
                    className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={async () => {
                      setApprovingChange(true);
                      try {
                        await onApproveChangeRequest(reservation.id);
                        onClose();
                      } finally {
                        setApprovingChange(false);
                      }
                    }}
                    disabled={approvingChange || rejectingChange}
                  >
                    {approvingChange ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {t('myReservation.approveChange')}
                  </Button>
                )}
              </div>
            )}
            {/* Link: Wyślij SMS o potwierdzeniu - dla confirmed i pending */}
            {['confirmed', 'pending'].includes(reservation.status) && onSendConfirmationSms && (
              <div className="mb-2">
                {reservation.confirmation_sms_sent_at && (
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-600" />
                    {t('reservations.smsSentAt', { datetime: format(new Date(reservation.confirmation_sms_sent_at), 'dd.MM.yyyy HH:mm', { locale: pl }) })}
                  </div>
                )}
                <button
                  onClick={async () => {
                    setSendingConfirmationSms(true);
                    try {
                      await onSendConfirmationSms(reservation.id);
                    } finally {
                      setSendingConfirmationSms(false);
                    }
                  }}
                  disabled={sendingConfirmationSms}
                  className="flex items-center gap-1.5 text-primary hover:text-primary/80 hover:underline text-[16px] disabled:opacity-50"
                >
                  {sendingConfirmationSms ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {reservation.confirmation_sms_sent_at 
                    ? t('reservations.sendConfirmationSmsAgain', { time: reservation.start_time.slice(0, 5) })
                    : t('reservations.sendConfirmationSms')}
                </button>
              </div>
            )}
            
            {/* Link: Wyślij SMS o odbiorze - nad Edit dla in_progress, completed, released */}
            {['in_progress', 'completed', 'released'].includes(reservation.status) && onSendPickupSms && (
              <div className="mb-2">
                {reservation.pickup_sms_sent_at && (
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-600" />
                    {t('reservations.smsSentAt', { datetime: format(new Date(reservation.pickup_sms_sent_at), 'dd.MM.yyyy HH:mm', { locale: pl }) })}
                  </div>
                )}
                <button
                  onClick={async () => {
                    setSendingPickupSms(true);
                    try {
                      await onSendPickupSms(reservation.id);
                    } finally {
                      setSendingPickupSms(false);
                    }
                  }}
                  disabled={sendingPickupSms}
                  className="flex items-center gap-1.5 text-primary hover:text-primary/80 hover:underline text-[16px] disabled:opacity-50"
                >
                  {sendingPickupSms ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {reservation.pickup_sms_sent_at 
                    ? t('reservations.sendPickupSmsAgain')
                    : t('reservations.sendPickupSms')}
                </button>
              </div>
            )}

            {/* Row 1: Edit and Delete for confirmed, in_progress, completed, released */}
            {(reservation.status === 'confirmed' || reservation.status === 'in_progress' || reservation.status === 'completed' || reservation.status === 'released') && (showEdit || showDelete) && (
              <div className="flex gap-2">
                {showEdit && onEdit && (
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={handleEdit}
                  >
                    <Pencil className="w-4 h-4" />
                    {t('common.edit')}
                  </Button>
                )}
                
                {/* Delete only for confirmed */}
                {showDelete && reservation.status === 'confirmed' && onDelete && (
                  <>
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={deleting || markingNoShow}
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {t('common.delete')}
                    </Button>
                    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('reservations.confirmDeleteTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('reservations.confirmDeleteDescription', { name: customerName, phone: customerPhone })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="sm:order-1">{t('common.cancel')}</AlertDialogCancel>
                          {onNoShow && (
                            <Button
                              variant="outline"
                              className="sm:order-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                              onClick={handleNoShow}
                              disabled={markingNoShow || deleting}
                            >
                              {markingNoShow ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : null}
                              {t('reservations.markAsNoShow')}
                            </Button>
                          )}
                          <AlertDialogAction 
                            onClick={handleDelete} 
                            className="sm:order-3 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting || markingNoShow}
                          >
                            {deleting ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            {t('reservations.yesDelete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}

            {/* Pending: Edit and Reject/Confirm actions */}
            {reservation.status === 'pending' && showEdit && (
              <div className="flex gap-2">
                {showEdit && onEdit && (
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={handleEdit}
                  >
                    <Pencil className="w-4 h-4" />
                    {t('common.edit')}
                  </Button>
                )}
              </div>
            )}

            {/* Pending: Reject and Confirm */}
            {reservation.status === 'pending' && (
              <div className="flex gap-2">
                {showDelete && onDelete && (
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
                        handleEdit();
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

            {/* Confirmed: Start Work with dropdown for all statuses */}
            {reservation.status === 'confirmed' && onStartWork && (
              <div className="flex gap-0">
                <Button 
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-r-none"
                  onClick={async () => {
                    setStartingWork(true);
                    try {
                      await onStartWork(reservation.id);
                    } finally {
                      setStartingWork(false);
                    }
                  }}
                  disabled={startingWork || changingStatus}
                >
                  {startingWork ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  {t('reservations.startWork')}
                </Button>
                
                {onStatusChange && (
                  <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        className="px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-l-none border-l border-emerald-500"
                        disabled={startingWork || changingStatus}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1 bg-background border shadow-lg z-50" align="end">
                      {['in_progress', 'completed', 'released'].map((status) => (
                        <Button
                          key={status}
                          variant="ghost"
                          className="w-full justify-start gap-2 text-sm"
                          onClick={async () => {
                            setStatusDropdownOpen(false);
                            setChangingStatus(true);
                            try {
                              await onStatusChange(reservation.id, status);
                            } finally {
                              setChangingStatus(false);
                            }
                          }}
                          disabled={changingStatus}
                        >
                          {changingStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          {t(`reservations.statuses.${status === 'in_progress' ? 'inProgress' : status}`)}
                        </Button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}


            {/* In Progress: End Work with dropdown for all statuses */}
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
                  disabled={endingWork || changingStatus}
                >
                  {endingWork ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {t('reservations.endWork')}
                </Button>
                
                {onStatusChange && (
                  <Popover open={inProgressDropdownOpen} onOpenChange={setInProgressDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        className="px-2 bg-sky-500 hover:bg-sky-600 text-white rounded-l-none border-l border-sky-400"
                        disabled={endingWork || changingStatus}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1 bg-background border shadow-lg z-50" align="end">
                      {['confirmed', 'completed', 'released'].map((status) => (
                        <Button
                          key={status}
                          variant="ghost"
                          className="w-full justify-start gap-2 text-sm"
                          onClick={async () => {
                            setInProgressDropdownOpen(false);
                            setChangingStatus(true);
                            try {
                              await onStatusChange(reservation.id, status);
                            } finally {
                              setChangingStatus(false);
                            }
                          }}
                          disabled={changingStatus}
                        >
                          {changingStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          {t(`reservations.statuses.${status}`)}
                        </Button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* Completed: Release Vehicle with dropdown for all statuses */}
            {reservation.status === 'completed' && onRelease && (
              <div className="flex gap-0">
                <Button 
                  className="flex-1 gap-2 rounded-r-none"
                  variant="outline"
                  onClick={async () => {
                    setReleasing(true);
                    try {
                      await onRelease(reservation.id);
                    } finally {
                      setReleasing(false);
                    }
                  }}
                  disabled={releasing || changingStatus}
                >
                  {releasing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Car className="w-4 h-4" />
                  )}
                  {t('reservations.releaseVehicle')}
                </Button>
                
                {onStatusChange && (
                  <Popover open={completedDropdownOpen} onOpenChange={setCompletedDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline"
                        className="px-2 rounded-l-none border-l-0"
                        disabled={releasing || changingStatus}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1 bg-background border shadow-lg z-50" align="end">
                      {['confirmed', 'in_progress', 'released'].map((status) => (
                        <Button
                          key={status}
                          variant="ghost"
                          className="w-full justify-start gap-2 text-sm"
                          onClick={async () => {
                            setCompletedDropdownOpen(false);
                            setChangingStatus(true);
                            try {
                              await onStatusChange(reservation.id, status);
                            } finally {
                              setChangingStatus(false);
                            }
                          }}
                          disabled={changingStatus}
                        >
                          {changingStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          {t(`reservations.statuses.${status === 'in_progress' ? 'inProgress' : status}`)}
                        </Button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* Released: Status change dropdown only */}
            {reservation.status === 'released' && onStatusChange && (
              <div className="flex gap-0">
                <Button 
                  variant="outline"
                  className="flex-1 gap-2 rounded-r-none"
                  disabled
                >
                  <Check className="w-4 h-4" />
                  {t('reservations.statuses.released')}
                </Button>
                
                <Popover open={releasedDropdownOpen} onOpenChange={setReleasedDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline"
                      className="px-2 rounded-l-none border-l-0"
                      disabled={changingStatus}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1 bg-background border shadow-lg z-50" align="end">
                    {['confirmed', 'in_progress', 'completed'].map((status) => (
                      <Button
                        key={status}
                        variant="ghost"
                        className="w-full justify-start gap-2 text-sm"
                        onClick={async () => {
                          setReleasedDropdownOpen(false);
                          setChangingStatus(true);
                          try {
                            await onStatusChange(reservation.id, status);
                          } finally {
                            setChangingStatus(false);
                          }
                        }}
                        disabled={changingStatus}
                      >
                        {changingStatus ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        {t(`reservations.statuses.${status === 'in_progress' ? 'inProgress' : status}`)}
                      </Button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      
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

export default ReservationDetailsDrawer;
