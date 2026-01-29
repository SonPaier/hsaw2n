import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { X, Loader2 } from 'lucide-react';
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
}

const HallReservationCard = ({
  reservation,
  open,
  onClose,
  onStartWork,
  onEndWork,
  onRelease,
  onSendPickupSms,
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
    const isPendingOrConfirmed = status === 'pending' || status === 'confirmed';
    const isInProgress = status === 'in_progress';
    const isCompleted = status === 'completed';

    if (isPendingOrConfirmed) {
      return (
        <Button
          onClick={handleStart}
          disabled={loading === 'start'}
          className="w-full py-7 text-2xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-lg"
        >
          {loading === 'start' ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            t('hallCard.start')
          )}
        </Button>
      );
    }

    if (isInProgress) {
      return (
        <Button
          onClick={handleStop}
          disabled={loading === 'stop'}
          className="w-full py-7 text-2xl font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg"
        >
          {loading === 'stop' ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            t('hallCard.stop')
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
            className="w-full py-6 text-xl font-semibold bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
          >
            {loading === 'sms' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('hallCard.sendPickupSms')
            )}
          </Button>
          <Button
            onClick={handleRelease}
            disabled={loading === 'release'}
            className="w-full py-7 text-2xl font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            {loading === 'release' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              t('hallCard.release')
            )}
          </Button>
        </div>
      );
    }

    // For released or other statuses, no action buttons
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl p-8 w-[70%] max-w-4xl min-w-[500px]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-gray-500" />
        </button>

        <div className="space-y-6">
          {/* Time and date - italic, gray, NOT bold */}
          <div className="text-[28px] italic text-gray-500">
            {formatTimeRange()} · {formatDateRange()}
          </div>

          {/* Customer name with phone AND vehicle on same line */}
          <div className="flex items-baseline gap-4 flex-wrap">
            <span className="text-xl font-bold">
              {customer_name} ({formatPhoneDisplay(customer_phone)})
            </span>
            <span className="text-xl text-gray-700">
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
            <div className="text-xl bg-yellow-100 text-red-600 rounded-lg p-4">
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
