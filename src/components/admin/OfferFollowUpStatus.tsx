import { ChevronDown, StickyNote } from 'lucide-react';
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
  currentStatus: FollowUpPhoneStatus;
  onStatusChange: (offerId: string, newStatus: FollowUpPhoneStatus) => void;
  hasInternalNote?: boolean;
  onNoteClick?: () => void;
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
  currentStatus,
  onStatusChange,
  hasInternalNote = false,
  onNoteClick,
}: OfferFollowUpStatusProps) {
  const currentConfig = currentStatus ? STATUS_CONFIG[currentStatus] : null;

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleStatusChange = (newStatus: FollowUpPhoneStatus) => {
    onStatusChange(offerId, newStatus);
  };

  return (
    <div className="flex items-center gap-1.5" onClick={handleStatusClick}>
      {/* Status dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              currentConfig ? currentConfig.className : DEFAULT_STATUS_CLASS
            )}
            onClick={handleStatusClick}
          >
            {currentConfig ? currentConfig.label : 'Status kontaktu'}
            <ChevronDown className="w-4 h-4" />
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
                    'px-4 py-1.5 rounded-full text-sm font-medium w-full text-center',
                    config.className
                  )}
                >
                  {config.label}
                </span>
              </DropdownMenuItem>
            )
          )}
          {/* Notatka option */}
          <DropdownMenuItem
            onClick={() => onNoteClick?.()}
            className="p-1"
          >
            <span
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium w-full text-center flex items-center justify-center gap-1.5',
                'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              <StickyNote className="w-3.5 h-3.5" />
              Notatka
            </span>
          </DropdownMenuItem>
          {currentStatus && (
            <DropdownMenuItem
              onClick={() => handleStatusChange(null)}
              className="p-1"
            >
              <span
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium w-full text-center',
                  DEFAULT_STATUS_CLASS
                )}
              >
                Usuń status
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Note icon - visible when internal note exists */}
      {hasInternalNote && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNoteClick?.();
          }}
          className="w-8 h-8 rounded-full bg-green-500 hover:bg-gray-600 flex items-center justify-center transition-colors"
          title="Notatka wewnętrzna"
        >
          <StickyNote className="w-4 h-4 text-white" />
        </button>
      )}
    </div>
  );
}
