import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { RotateCcw } from 'lucide-react';
import {
  GroupedChange,
  ReservationChange,
  formatServicesDiff,
  formatStatus,
  formatTimeShort,
} from '@/services/reservationHistoryService';
import { Button } from '@/components/ui/button';

interface Props {
  group: GroupedChange;
  servicesMap: Map<string, string>;
  stationsMap: Map<string, string>;
  onRevert?: (change: ReservationChange) => void;
}

export function HistoryTimelineItem({ group, servicesMap, stationsMap, onRevert }: Props) {
  const renderChange = (change: ReservationChange) => {
    // Skip car_size changes - don't display them
    if (change.field_name === 'car_size') {
      return null;
    }

    let content: React.ReactNode = null;

    switch (change.field_name) {
      case 'service_ids': {
        const { added, removed } = formatServicesDiff(
          change.old_value,
          change.new_value,
          servicesMap
        );
        content = (
          <div className="space-y-0.5">
            {added.length > 0 && <div>• Dodano: {added.join(', ')}</div>}
            {removed.length > 0 && <div>• Usunięto: {removed.join(', ')}</div>}
          </div>
        );
        break;
      }

      case 'price':
        content = <div>• Cena: {change.old_value ?? '-'} zł → {change.new_value ?? '-'} zł</div>;
        break;

      case 'status':
        content = <div>• Status: {formatStatus(change.old_value)} → {formatStatus(change.new_value)}</div>;
        break;

      case 'station_id':
        content = (
          <div>
            • Stanowisko: {stationsMap.get(change.old_value) || '-'} → {stationsMap.get(change.new_value) || '-'}
          </div>
        );
        break;

      case 'times': {
        const oldStart = formatTimeShort(change.old_value?.start_time);
        const oldEnd = formatTimeShort(change.old_value?.end_time);
        const newStart = formatTimeShort(change.new_value?.start_time);
        const newEnd = formatTimeShort(change.new_value?.end_time);
        content = <div>• Godzina: {oldStart}-{oldEnd} → {newStart}-{newEnd}</div>;
        break;
      }

      case 'dates': {
        const oldDate = change.old_value?.reservation_date
          ? format(new Date(change.old_value.reservation_date), 'd MMM', { locale: pl })
          : '-';
        const newDate = change.new_value?.reservation_date
          ? format(new Date(change.new_value.reservation_date), 'd MMM', { locale: pl })
          : '-';
        content = <div>• Termin: {oldDate} → {newDate}</div>;
        break;
      }

      case 'change_request_note':
        content = <div className="italic text-muted-foreground">"{change.new_value}"</div>;
        break;

      case 'customer_name':
        content = <div>• Klient: {change.old_value || '-'} → {change.new_value || '-'}</div>;
        break;

      case 'vehicle_plate':
        content = <div>• Pojazd: {change.old_value || '-'} → {change.new_value || '-'}</div>;
        break;

      case 'admin_notes':
        if (!change.old_value && change.new_value) {
          content = <div>• Dodano notatkę</div>;
        } else if (change.old_value && !change.new_value) {
          content = <div>• Usunięto notatkę</div>;
        } else {
          content = <div>• Zmieniono notatkę</div>;
        }
        break;

      case 'offer_number':
        content = <div>• Oferta: #{change.old_value || '-'} → #{change.new_value || '-'}</div>;
        break;

      default:
        content = (
          <div>
            • {change.field_name}: {JSON.stringify(change.old_value)} → {JSON.stringify(change.new_value)}
          </div>
        );
    }

    if (!content) return null;

    return (
      <div key={change.id} className="flex items-start justify-between gap-2 group">
        <div className="flex-1">{content}</div>
        {onRevert && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => onRevert(change)}
            title="Cofnij tę zmianę"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="relative pl-6 pb-6 border-l-2 border-muted last:border-transparent overflow-visible">
      <div className="absolute left-[-4px] top-1 w-[6px] h-[6px] rounded-full bg-primary" />

      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-base font-medium text-foreground">
          {group.changed_by_username}
          {group.changed_by_type === 'customer' && ' (klient)'}
          {' • '}
          {format(new Date(group.created_at), 'd MMM, HH:mm', { locale: pl })}
        </div>
      </div>

      <div className="space-y-1 text-sm">{group.changes.map(renderChange)}</div>
    </div>
  );
}
