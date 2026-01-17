import { supabase } from '@/integrations/supabase/client';

export interface ReservationChange {
  id: string;
  reservation_id: string | null;
  change_type: 'created' | 'updated';
  field_name: string | null;
  old_value: any;
  new_value: any;
  batch_id: string;
  changed_by_username: string;
  changed_by_type: 'admin' | 'customer' | 'system';
  created_at: string;
}

export interface GroupedChange {
  batch_id: string;
  changed_by_username: string;
  changed_by_type: 'admin' | 'customer' | 'system';
  created_at: string;
  changes: ReservationChange[];
}

/**
 * Fetch reservation history (lazy load - only when drawer opens)
 */
export async function fetchReservationHistory(reservationId: string): Promise<GroupedChange[]> {
  const { data, error } = await supabase
    .from('reservation_changes')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Group by batch_id
  const grouped = new Map<string, GroupedChange>();
  for (const change of data || []) {
    if (!grouped.has(change.batch_id)) {
      grouped.set(change.batch_id, {
        batch_id: change.batch_id,
        changed_by_username: change.changed_by_username,
        changed_by_type: change.changed_by_type as 'admin' | 'customer' | 'system',
        created_at: change.created_at,
        changes: [],
      });
    }
    grouped.get(change.batch_id)!.changes.push({
      ...change,
      change_type: change.change_type as 'created' | 'updated',
      changed_by_type: change.changed_by_type as 'admin' | 'customer' | 'system',
    });
  }

  return Array.from(grouped.values());
}

/**
 * Format services DIFF - show added/removed services
 */
export function formatServicesDiff(
  oldIds: string[] | null,
  newIds: string[] | null,
  servicesMap: Map<string, string>
): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldIds || []);
  const newSet = new Set(newIds || []);

  const added = [...newSet]
    .filter(id => !oldSet.has(id))
    .map(id => servicesMap.get(id) || id);
  const removed = [...oldSet]
    .filter(id => !newSet.has(id))
    .map(id => servicesMap.get(id) || id);

  return { added, removed };
}

/**
 * Format status to Polish
 */
export function formatStatus(status: string | null): string {
  if (!status) return '-';
  const statusMap: Record<string, string> = {
    pending: 'Oczekująca',
    confirmed: 'Potwierdzona',
    in_progress: 'W trakcie',
    completed: 'Zrealizowana',
    released: 'Wydana',
    cancelled: 'Anulowana',
    no_show: 'Nieobecność',
    change_requested: 'Prośba o zmianę',
  };
  return statusMap[status] || status;
}

/**
 * Get icon for field type
 */
export function getFieldIcon(fieldName: string): string {
  const iconMap: Record<string, string> = {
    service_ids: '🔧',
    dates: '📅',
    times: '⏱️',
    station_id: '🏢',
    price: '💰',
    status: '📊',
    customer_name: '👤',
    vehicle_plate: '🚗',
    car_size: '📐',
    admin_notes: '📝',
    offer_number: '📋',
    change_request_note: '💬',
  };
  return iconMap[fieldName] || '•';
}

/**
 * Format time string (HH:MM:SS -> HH:MM)
 */
export function formatTimeShort(time: string | null): string {
  if (!time) return '-';
  return time.slice(0, 5);
}
