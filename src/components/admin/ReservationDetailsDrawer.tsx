import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Car, Clock, Loader2, Trash2, Pencil, MessageSquare, PhoneCall, Check, CheckCircle2, ChevronDown, RotateCcw, X } from 'lucide-react';
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
  notes?: string;
  source?: string | null;
  service_id?: string;
  service_ids?: string[];
  service?: {
    name: string;
  };
  services_data?: Array<{
    name: string;
    shortcut?: string | null;
  }>;
  station?: {
    name: string;
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
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
  onRevertToInProgress 
}: ReservationDetailsDrawerProps) => {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [markingNoShow, setMarkingNoShow] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [startingWork, setStartingWork] = useState(false);
  const [endingWork, setEndingWork] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [inProgressDropdownOpen, setInProgressDropdownOpen] = useState(false);
  const [completedDropdownOpen, setCompletedDropdownOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carSize, setCarSize] = useState<CarSize | ''>('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (reservation) {
      setCustomerName(reservation.customer_name || '');
      setCustomerPhone(reservation.customer_phone || '');
      setCarModel(reservation.vehicle_plate || '');
      setCarSize(reservation.car_size || '');
      setNotes(reservation.notes || '');
      setPrice(reservation.price?.toString() || '');
      setStartTime(reservation.start_time || '');
      setEndTime(reservation.end_time || '');
    }
  }, [reservation]);

  const getSourceLabel = (source?: string | null) => {
    if (!source || source === 'admin') {
      return <Badge variant="outline" className="text-xs font-normal">{t('reservations.addedBy')}: {t('reservations.sources.employee')}</Badge>;
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
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent 
          side="right" 
          className="sm:max-w-lg w-full flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.2)]"
          hideCloseButton
          hideOverlay
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
                  {getSourceLabel(reservation.source)}
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 -mt-1 -mr-2"
                onClick={onClose}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </SheetHeader>

          {/* Content area - scrollable */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
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
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
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
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">{t('common.phone')}</div>
                <div className="font-medium">{customerPhone}</div>
              </div>
            </div>

            {/* Reservation code */}
            {reservation.confirmation_code && (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold text-xs">#</div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('reservations.reservationCode')}</div>
                  <div className="font-mono font-bold text-primary">{reservation.confirmation_code}</div>
                </div>
              </div>
            )}

            {/* Car model */}
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

            {/* Notes */}
            {notes && (
              <div className="border-t border-border/30 pt-3">
                <div className="text-xs text-muted-foreground mb-1">{t('common.notes')}</div>
                <div className="text-sm whitespace-pre-wrap">{notes}</div>
              </div>
            )}

            {/* Price */}
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

          {/* Footer with actions - pinned at bottom */}
          <div className="flex-shrink-0 border-t pt-4 space-y-2">
            {/* Row 1: Edit and Delete for confirmed, in_progress, completed, released */}
            {(reservation.status === 'confirmed' || reservation.status === 'in_progress' || reservation.status === 'completed' || reservation.status === 'released') && (
              <div className="flex gap-2">
                {onEdit && (
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
                {reservation.status === 'confirmed' && onDelete && (
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
            {reservation.status === 'pending' && (
              <div className="flex gap-2">
                {onEdit && (
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

            {/* Completed: Release Vehicle with dropdown for revert to in_progress */}
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
                  disabled={releasing || reverting}
                >
                  {releasing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Car className="w-4 h-4" />
                  )}
                  {t('reservations.releaseVehicle')}
                </Button>
                
                {onRevertToInProgress && (
                  <Popover open={completedDropdownOpen} onOpenChange={setCompletedDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline"
                        className="px-2 rounded-l-none border-l-0"
                        disabled={releasing || reverting}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1 bg-background border shadow-lg z-50" align="end">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 text-sm"
                        onClick={async () => {
                          setCompletedDropdownOpen(false);
                          setReverting(true);
                          try {
                            await onRevertToInProgress(reservation.id);
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
                        {t('reservations.revertToInProgress')}
                      </Button>
                    </PopoverContent>
                  </Popover>
                )}
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
