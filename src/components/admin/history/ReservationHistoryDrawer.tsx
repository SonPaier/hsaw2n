import { useEffect, useState } from 'react';
import { X, Loader2, History } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchReservationHistory, GroupedChange } from '@/services/reservationHistoryService';
import { HistoryCreatedCard } from './HistoryCreatedCard';
import { HistoryTimelineItem } from './HistoryTimelineItem';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  reservationId: string | null;
  instanceId: string;
  open: boolean;
  onClose: () => void;
  /** When true, fetch 'both' service_type; when false, fetch 'reservation' */
  hasUnifiedServices?: boolean;
}

export function ReservationHistoryDrawer({ reservationId, instanceId, open, onClose, hasUnifiedServices = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<GroupedChange[]>([]);
  const [servicesMap, setServicesMap] = useState<Map<string, string>>(new Map());
  const [stationsMap, setStationsMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!open || !reservationId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch services based on has_unified_services:
        // - unified → fetch 'both' AND 'reservation' to cover all IDs
        // - legacy → fetch only 'reservation'
        let servicesQuery = supabase
          .from('unified_services')
          .select('id, name, short_name')
          .eq('instance_id', instanceId);
        
        if (hasUnifiedServices) {
          // Unified: fetch both types to cover all historical service IDs
          servicesQuery = servicesQuery.in('service_type', ['both', 'reservation']);
        } else {
          // Legacy: only reservation services
          servicesQuery = servicesQuery.eq('service_type', 'reservation');
        }

        // Parallel fetch for performance
        const [historyData, servicesRes, stationsRes] = await Promise.all([
          fetchReservationHistory(reservationId),
          servicesQuery,
          supabase.from('stations').select('id, name').eq('instance_id', instanceId),
        ]);

        setHistory(historyData);

        const sMap = new Map<string, string>();
        for (const s of servicesRes.data || []) {
          sMap.set(s.id, s.short_name || s.name);
        }
        setServicesMap(sMap);

        const stMap = new Map<string, string>();
        for (const st of stationsRes.data || []) {
          stMap.set(st.id, st.name);
        }
        setStationsMap(stMap);
      } catch (err) {
        console.error('Failed to load reservation history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, reservationId, instanceId, hasUnifiedServices]);

  // Handle close with explicit callback
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose} modal={true}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[27rem] flex flex-col"
        hideCloseButton
      >
        <SheetHeader className="flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <SheetTitle>Historia zmian</SheetTitle>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Brak historii zmian
            </div>
          ) : (
            <div className="flex flex-col gap-2 pr-2">
              {history.map((group) =>
                group.changes[0]?.change_type === 'created' ? (
                  <HistoryCreatedCard
                    key={group.batch_id}
                    group={group}
                    servicesMap={servicesMap}
                    stationsMap={stationsMap}
                  />
                ) : (
                  <HistoryTimelineItem
                    key={group.batch_id}
                    group={group}
                    servicesMap={servicesMap}
                    stationsMap={stationsMap}
                  />
                )
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
