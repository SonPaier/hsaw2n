import { Phone, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type FollowUpPhoneStatus = 'called_discussed' | 'call_later' | 'called_no_answer' | null;

interface OfferFollowUpStatusProps {
  offerId: string;
  phone: string;
  currentStatus: FollowUpPhoneStatus;
  onStatusChange: (offerId: string, newStatus: FollowUpPhoneStatus) => void;
}

const STATUS_CONFIG: Record<NonNullable<FollowUpPhoneStatus>, { label: string; className: string }> = {
  called_discussed: {
    label: 'Dzwoniłem, omówione',
    className: 'bg-green-500 text-white hover:bg-green-600',
  },
  call_later: {
    label: 'Zadzwonić kiedy indziej',
    className: 'bg-yellow-400 text-gray-800 hover:bg-yellow-500',
  },
  called_no_answer: {
    label: 'Dzwoniłem, nieodebrane',
    className: 'bg-orange-500 text-white hover:bg-orange-600',
  },
};

const DEFAULT_STATUS_CLASS = 'bg-gray-200 text-gray-600 hover:bg-gray-300';

export function OfferFollowUpStatus({
  offerId,
  phone,
  currentStatus,
  onStatusChange,
}: OfferFollowUpStatusProps) {
  const currentConfig = currentStatus ? STATUS_CONFIG[currentStatus] : null;

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleStatusChange = (newStatus: FollowUpPhoneStatus) => {
    onStatusChange(offerId, newStatus);
  };

  return (
    <div className="flex items-center gap-2" onClick={handleStatusClick}>
      {/* Phone icon - opens dialer */}
      <a
        href={`tel:${phone}`}
        onClick={handlePhoneClick}
        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        title={`Zadzwoń: ${phone}`}
      >
        <Phone className="w-4 h-4 text-gray-500" />
      </a>

      {/* Status dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors',
              currentConfig ? currentConfig.className : DEFAULT_STATUS_CLASS
            )}
            onClick={handleStatusClick}
          >
            {currentConfig ? currentConfig.label : 'Ustaw status'}
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={handleStatusClick}>
          {(Object.entries(STATUS_CONFIG) as [NonNullable<FollowUpPhoneStatus>, typeof STATUS_CONFIG[NonNullable<FollowUpPhoneStatus>]][]).map(
            ([status, config]) => (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusChange(status)}
                className="p-1"
              >
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium w-full text-center',
                    config.className
                  )}
                >
                  {config.label}
                </span>
              </DropdownMenuItem>
            )
          )}
          {currentStatus && (
            <DropdownMenuItem
              onClick={() => handleStatusChange(null)}
              className="p-1"
            >
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium w-full text-center',
                  DEFAULT_STATUS_CLASS
                )}
              >
                Usuń status
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
