import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  GroupedChange,
  ReservationChange,
  formatServicesDiff,
  formatStatus,
  getFieldIcon,
  formatTimeShort,
} from '@/services/reservationHistoryService';

interface Props {
  group: GroupedChange;
  servicesMap: Map<string, string>;
  stationsMap: Map<string, string>;
}

export function HistoryTimelineItem({ group, servicesMap, stationsMap }: Props) {
  const renderChange = (change: ReservationChange) => {
    const icon = getFieldIcon(change.field_name || '');

    switch (change.field_name) {
      case 'service_ids': {
        const { added, removed } = formatServicesDiff(
          change.old_value,
          change.new_value,
          servicesMap
        );
        return (
          <div key={change.id} className="space-y-0.5">
            {added.length > 0 && (
              <div>
                {icon} Dodano: {added.join(', ')}
              </div>
            )}
            {removed.length > 0 && (
              <div>
                {icon} Usunięto: {removed.join(', ')}
              </div>
            )}
          </div>
        );
      }

      case 'price':
        return (
          <div key={change.id}>
            {icon} Cena: {change.old_value ?? '-'} zł → {change.new_value ?? '-'} zł
          </div>
        );

      case 'status':
        return (
          <div key={change.id}>
            {icon} Status: {formatStatus(change.old_value)} → {formatStatus(change.new_value)}
          </div>
        );

      case 'station_id':
        return (
          <div key={change.id}>
            {icon} Stanowisko: {stationsMap.get(change.old_value) || '-'} →{' '}
            {stationsMap.get(change.new_value) || '-'}
          </div>
        );

      case 'times': {
        const oldStart = formatTimeShort(change.old_value?.start_time);
        const oldEnd = formatTimeShort(change.old_value?.end_time);
        const newStart = formatTimeShort(change.new_value?.start_time);
        const newEnd = formatTimeShort(change.new_value?.end_time);
        return (
          <div key={change.id}>
            {icon} Godzina: {oldStart}-{oldEnd} → {newStart}-{newEnd}
          </div>
        );
      }

      case 'dates': {
        const oldDate = change.old_value?.reservation_date
          ? format(new Date(change.old_value.reservation_date), 'd MMM', { locale: pl })
          : '-';
        const newDate = change.new_value?.reservation_date
          ? format(new Date(change.new_value.reservation_date), 'd MMM', { locale: pl })
          : '-';
        return (
          <div key={change.id}>
            {icon} Termin: {oldDate} → {newDate}
          </div>
        );
      }

      case 'change_request_note':
        return (
          <div key={change.id} className="italic text-muted-foreground">
            "{change.new_value}"
          </div>
        );

      case 'customer_name':
        return (
          <div key={change.id}>
            {icon} Klient: {change.old_value || '-'} → {change.new_value || '-'}
          </div>
        );

      case 'vehicle_plate':
        return (
          <div key={change.id}>
            {icon} Pojazd: {change.old_value || '-'} → {change.new_value || '-'}
          </div>
        );

      case 'car_size':
        return (
          <div key={change.id}>
            {icon} Rozmiar: {(change.old_value || '-').toUpperCase()} →{' '}
            {(change.new_value || '-').toUpperCase()}
          </div>
        );

      case 'admin_notes':
        if (!change.old_value && change.new_value) {
          return (
            <div key={change.id}>
              {icon} Dodano notatkę
            </div>
          );
        }
        if (change.old_value && !change.new_value) {
          return (
            <div key={change.id}>
              {icon} Usunięto notatkę
            </div>
          );
        }
        return (
          <div key={change.id}>
            {icon} Zmieniono notatkę
          </div>
        );

      case 'offer_number':
        return (
          <div key={change.id}>
            {icon} Oferta: #{change.old_value || '-'} → #{change.new_value || '-'}
          </div>
        );

      default:
        return (
          <div key={change.id}>
            {icon} {change.field_name}: {JSON.stringify(change.old_value)} →{' '}
            {JSON.stringify(change.new_value)}
          </div>
        );
    }
  };

  return (
    <div className="relative pl-6 pb-6 border-l-2 border-muted last:border-transparent">
      <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-primary" />

      <div className="text-sm text-muted-foreground mb-1">
        {group.changed_by_username}
        {group.changed_by_type === 'customer' && ' (klient)'}
        {' • '}
        {format(new Date(group.created_at), 'd MMM, HH:mm', { locale: pl })}
      </div>

      <div className="space-y-0.5 text-sm">{group.changes.map(renderChange)}</div>
    </div>
  );
}
