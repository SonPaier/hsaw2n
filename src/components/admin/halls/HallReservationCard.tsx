import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { X, Loader2, FileText, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { useTranslation } from 'react-i18next';

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
    services_data?: Array<{ name: string }>;
    admin_notes?: string | null;
    instance_id: string;
  };
  open: boolean;
  onClose: () => void;
  onStartWork: (id: string) => Promise<void>;
  onEndWork: (id: string) => Promise<void>;
  onRelease: (id: string) => Promise<void>;
  onSendPickupSms: (id: string) => Promise<void>;
  onAddProtocol?: (reservation: HallReservationCardProps['reservation']) => void;
  onAddPhotos?: (reservation: HallReservationCardProps['reservation']) => void;
}

const HallReservationCard = ({
  reservation,
  open,
  onClose,
  onStartWork,
  onEndWork,
  onRelease,
  onSendPickupSms,
  onAddProtocol,
  onAddPhotos,
}: HallReservationCardProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<'start' | 'stop' | 'sms' | 'release' | null>(null);

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

  const handleRelease = async () => {
    setLoading('release');
    try {
      await onRelease(id);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  // Render action buttons based on status
  const renderActionButtons = () => {
    const isPendingOrConfirmed = normalizedStatus === 'pending' || normalizedStatus === 'confirmed';
    const isInProgress = normalizedStatus === 'in_progress';
    const isCompleted = normalizedStatus === 'completed';
    const isCancelled = normalizedStatus === 'cancelled';
    const isReleased = normalizedStatus === 'released';

    if (isPendingOrConfirmed) {
      return (
        <div className="space-y-3">
          {/* Protocol and Photos buttons */}
          {(onAddProtocol || onAddPhotos) && (
            <div className="flex gap-2">
              {onAddProtocol && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => onAddProtocol(reservation)}
                >
                  <FileText className="w-5 h-5" />
                  {t('hallCard.protocol', { defaultValue: 'Protokół' })}
                </Button>
              )}
              {onAddPhotos && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => onAddPhotos(reservation)}
                >
                  <Camera className="w-5 h-5" />
                  {t('hallCard.photos', { defaultValue: 'Zdjęcia' })}
                </Button>
              )}
            </div>
          )}
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
        </div>
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
        <div className="space-y-3">
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
          <Button
            onClick={handleRelease}
            disabled={loading === 'release'}
            className="w-full py-7 text-2xl font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading === 'release' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              t('hallCard.release', { defaultValue: 'WYDAJ' })
            )}
          </Button>
        </div>
      );
    }

    // For released / cancelled (and any other status), just show close button
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
          {/* Time and date - italic, black (foreground), NOT bold */}
          <div className="text-[28px] italic text-foreground">
            {formatTimeRange()} · {formatDateRange()}
          </div>

          {/* Customer name with phone AND vehicle on same line */}
          <div className="flex items-baseline gap-4 flex-wrap">
            <span className="text-xl font-bold">
              {customer_name} ({formatPhoneDisplay(customer_phone)})
            </span>
            <span className="text-lg font-semibold text-muted-foreground">
              {vehicle_plate}
            </span>
          </div>

          {/* Services list - numbered, vertical, bold */}
          {services_data && services_data.length > 0 && (
            <div className="space-y-1">
              {services_data.map((service, idx) => (
                <div key={idx} className="text-2xl font-bold">
                  {idx + 1}. {service.name}
                </div>
              ))}
            </div>
          )}

          {/* Admin notes - yellow background, red text */}
          {admin_notes && (
            <div className="text-xl bg-warning/20 text-destructive rounded-lg p-4">
              {admin_notes}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4">
            {renderActionButtons()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HallReservationCard;
