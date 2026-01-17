import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Sparkles } from 'lucide-react';
import { GroupedChange, formatTimeShort } from '@/services/reservationHistoryService';

interface Props {
  group: GroupedChange;
  servicesMap: Map<string, string>;
  stationsMap: Map<string, string>;
}

export function HistoryCreatedCard({ group, servicesMap, stationsMap }: Props) {
  const snapshot = group.changes[0]?.new_value;
  if (!snapshot) return null;

  const serviceNames = (snapshot.service_ids || [])
    .map((id: string) => servicesMap.get(id) || id)
    .filter(Boolean)
    .join(', ');

  const stationName = snapshot.station_id ? stationsMap.get(snapshot.station_id) : null;

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-green-600" />
        <span className="font-semibold text-green-800">Rezerwacja utworzona</span>
      </div>
      <div className="text-base font-medium text-foreground mb-2">
        {group.changed_by_username} • {format(new Date(group.created_at), 'd MMM, HH:mm', { locale: pl })}
      </div>

      <div className="space-y-1 text-sm">
        {snapshot.reservation_date && (
          <div>
            • {format(new Date(snapshot.reservation_date), 'd MMM yyyy', { locale: pl })}
            {snapshot.start_time && snapshot.end_time && (
              <>, {formatTimeShort(snapshot.start_time)}-{formatTimeShort(snapshot.end_time)}</>
            )}
          </div>
        )}
        {stationName && <div>• Stanowisko: {stationName}</div>}
        {serviceNames && <div>• {serviceNames}</div>}
        {snapshot.vehicle_plate && <div>• {snapshot.vehicle_plate}</div>}
        {snapshot.price != null && <div>• {snapshot.price} zł</div>}
        {snapshot.admin_notes && <div>• {snapshot.admin_notes}</div>}
        {snapshot.offer_number && <div>• Oferta #{snapshot.offer_number}</div>}
      </div>
    </div>
  );
}
