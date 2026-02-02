import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { X, Loader2, FileText, Camera, Check, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { useTranslation } from 'react-i18next';
import { PhotoFullscreenDialog } from '@/components/protocols/PhotoFullscreenDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

interface HallReservationCardProps {
  reservation: {
    id: string;
    customer_name: string;
    customer_phone: string;
    vehicle_plate: string;
    reservation_date: string;
    end_date?: string | null;
    start_time: string;
    end_time: string;
    status: string;
    services_data?: Array<{ id?: string; name: string }>;
    admin_notes?: string | null;
    instance_id: string;
    photo_urls?: string[] | null;
    checked_service_ids?: string[] | null;
  };
  open: boolean;
  onClose: () => void;
  onStartWork: (id: string) => Promise<void>;
  onEndWork: (id: string) => Promise<void>;
  onSendPickupSms: (id: string) => Promise<void>;
  onAddProtocol?: (reservation: HallReservationCardProps['reservation']) => void;
  onAddPhotos?: (reservation: HallReservationCardProps['reservation']) => void;
  onServiceToggle?: (serviceId: string, checked: boolean) => Promise<void>;
  onAddService?: (reservation: HallReservationCardProps['reservation']) => void;
  onRemoveService?: (serviceId: string, serviceName: string) => Promise<void>;
}

const HallReservationCard = ({
  reservation,
  open,
  onClose,
  onStartWork,
  onEndWork,
  onSendPickupSms,
  onAddProtocol,
  onAddPhotos,
  onServiceToggle,
  onAddService,
  onRemoveService,
}: HallReservationCardProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<'start' | 'stop' | 'sms' | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [confirmRemoveService, setConfirmRemoveService] = useState<{ id: string; name: string } | null>(null);
  const [removingService, setRemovingService] = useState(false);

  if (!open || !reservation) return null;

  const {
    id,
    customer_name,
    customer_phone,
    vehicle_plate,
    reservation_date,
    end_date,
    start_time,
    end_time,
    status,
    services_data,
    admin_notes,
    photo_urls,
    checked_service_ids,
  } = reservation;

  const normalizedStatus = (status ?? '').toLowerCase().trim();

  // Format time range
  const formatTimeRange = () => {
    return `${start_time.slice(0, 5)} - ${end_time.slice(0, 5)}`;
  };

  // Format date range
  const formatDateRange = () => {
    const startDate = parseISO(reservation_date);
    if (end_date && end_date !== reservation_date) {
      const endDate = parseISO(end_date);
      return `${format(startDate, 'd MMM', { locale: pl })} - ${format(endDate, 'd MMM yyyy', { locale: pl })}`;
    }
    return format(startDate, 'd MMMM yyyy', { locale: pl });
  };

  // Handle actions with loading states
  const handleStart = async () => {
    setLoading('start');
    try {
      await onStartWork(id);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const handleStop = async () => {
    setLoading('stop');
    try {
      await onEndWork(id);
    } finally {
      setLoading(null);
    }
  };

  const handleSendSms = async () => {
    setLoading('sms');
    try {
      await onSendPickupSms(id);
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmRemoveService = async () => {
    if (!confirmRemoveService || !onRemoveService) return;
    setRemovingService(true);
    try {
      await onRemoveService(confirmRemoveService.id, confirmRemoveService.name);
    } finally {
      setRemovingService(false);
      setConfirmRemoveService(null);
    }
  };

  // Render action buttons based on status
  const renderActionButtons = () => {
    const isPendingOrConfirmed = normalizedStatus === 'pending' || normalizedStatus === 'confirmed';
    const isInProgress = normalizedStatus === 'in_progress';
    const isCompleted = normalizedStatus === 'completed';

    if (isPendingOrConfirmed) {
      return (
        <Button
          onClick={handleStart}
          disabled={loading === 'start'}
          className="w-full py-7 text-2xl font-bold rounded-lg bg-success text-success-foreground hover:bg-success/90"
        >
          {loading === 'start' ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            t('hallCard.start', { defaultValue: 'START' })
          )}
        </Button>
      );
    }

    if (isInProgress) {
      return (
        <Button
          onClick={handleStop}
          disabled={loading === 'stop'}
          className="w-full py-7 text-2xl font-bold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {loading === 'stop' ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            t('hallCard.stop', { defaultValue: 'STOP' })
          )}
        </Button>
      );
    }

    if (isCompleted) {
      return (
        <Button
          onClick={handleSendSms}
          disabled={loading === 'sms'}
          className="w-full py-6 text-xl font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90"
        >
          {loading === 'sms' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            t('hallCard.sendPickupSms', { defaultValue: 'Wyślij SMS: auto do odbioru' })
          )}
        </Button>
      );
    }

    // For cancelled (and any other status), just show close button
    return (
      <Button
        variant="secondary"
        onClick={onClose}
        className="w-full py-6 text-xl font-semibold rounded-lg"
      >
        {t('common.close', { defaultValue: 'Zamknij' })}
      </Button>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
        <div className="relative bg-card text-card-foreground rounded-xl shadow-2xl p-8 w-[70%] max-w-4xl min-w-[500px]">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-muted-foreground" />
          </button>

          <div className="space-y-6">
            {/* Time (bold) and date */}
            <div className="text-[28px] text-foreground">
              <span className="font-bold">{formatTimeRange()}</span>
              <span className="text-muted-foreground"> · {formatDateRange()}</span>
            </div>

            {/* Vehicle plate first, then customer */}
            <div className="space-y-1">
              <div className="text-xl font-bold text-foreground">
                {vehicle_plate}
              </div>
              <div className="text-lg text-muted-foreground">
                {customer_name}, {formatPhoneDisplay(customer_phone)}
              </div>
            </div>

            {/* Services list - clickable with checkmark toggle and delete */}
            {services_data && services_data.length > 0 && (
              <div className="space-y-1">
                {services_data.map((service, idx) => {
                  const isChecked = service.id && checked_service_ids?.includes(service.id);
                  const canToggle = !!service.id && !!onServiceToggle;
                  
                  return (
                    <div 
                      key={service.id || idx} 
                      className="flex items-center justify-between gap-2"
                    >
                      <div 
                        className={cn(
                          "text-2xl font-bold flex items-center gap-2 flex-1",
                          canToggle && "cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 py-1",
                          isChecked && "text-muted-foreground"
                        )}
                        onClick={canToggle ? () => onServiceToggle(service.id!, !isChecked) : undefined}
                      >
                        <span className={isChecked ? "line-through" : ""}>
                          {idx + 1}. {service.name}
                        </span>
                        {isChecked && <Check className="w-6 h-6 text-success" />}
                      </div>
                      
                      {/* Red trash icon for delete */}
                      {onRemoveService && service.id && (
                        <button
                          onClick={() => setConfirmRemoveService({ id: service.id!, name: service.name })}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Photos thumbnails */}
            {photo_urls && photo_urls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photo_urls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Zdjęcie ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setFullscreenPhoto(url)}
                  />
                ))}
              </div>
            )}

            {/* Admin notes - yellow background, red text */}
            {admin_notes && (
              <div className="text-xl bg-warning/20 text-destructive rounded-lg p-4">
                {admin_notes}
              </div>
            )}

            {/* Protocol, Photos, and Services buttons - white style */}
            {(onAddProtocol || onAddPhotos || onAddService) && (
              <div className="flex gap-2">
                {onAddService && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 bg-white hover:bg-gray-50"
                    onClick={() => onAddService(reservation)}
                  >
                    <Settings2 className="w-5 h-5" />
                    Usługi
                  </Button>
                )}
                {onAddProtocol && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 bg-white hover:bg-gray-50"
                    onClick={() => onAddProtocol(reservation)}
                  >
                    <FileText className="w-5 h-5" />
                    {t('hallCard.protocol', { defaultValue: 'Protokół' })}
                  </Button>
                )}
                {onAddPhotos && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 bg-white hover:bg-gray-50"
                    onClick={() => onAddPhotos(reservation)}
                  >
                    <Camera className="w-5 h-5" />
                    {t('hallCard.photos', { defaultValue: 'Zdjęcia' })}
                  </Button>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-4">
              {renderActionButtons()}
            </div>
          </div>
        </div>
      </div>

      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => !open && setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto}
      />

      {/* Confirm remove service dialog */}
      <ConfirmDialog
        open={!!confirmRemoveService}
        onOpenChange={(open) => !open && setConfirmRemoveService(null)}
        title="Usunąć usługę?"
        description={`Czy na pewno chcesz usunąć "${confirmRemoveService?.name}" z tej rezerwacji?`}
        confirmLabel="Usuń"
        variant="destructive"
        loading={removingService}
        onConfirm={handleConfirmRemoveService}
      />
    </>
  );
};

export default HallReservationCard;
