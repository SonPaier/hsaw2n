import { useEffect, useState } from 'react';
import { X, Loader2, History } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchReservationHistory, GroupedChange, ReservationChange } from '@/services/reservationHistoryService';
import { HistoryCreatedCard } from './HistoryCreatedCard';
import { HistoryTimelineItem } from './HistoryTimelineItem';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  reservationId: string | null;
  instanceId: string;
  open: boolean;
  onClose: () => void;
  onRevertSuccess?: () => void;
}

export function ReservationHistoryDrawer({ reservationId, instanceId, open, onClose, onRevertSuccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<GroupedChange[]>([]);
  const [servicesMap, setServicesMap] = useState<Map<string, string>>(new Map());
  const [stationsMap, setStationsMap] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !reservationId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Parallel fetch for performance
        const [historyData, servicesRes, stationsRes] = await Promise.all([
          fetchReservationHistory(reservationId),
          supabase.from('services').select('id, name, shortcut').eq('instance_id', instanceId),
          supabase.from('stations').select('id, name').eq('instance_id', instanceId),
        ]);

        setHistory(historyData);

        const sMap = new Map<string, string>();
        for (const s of servicesRes.data || []) {
          sMap.set(s.id, s.shortcut || s.name);
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
  }, [open, reservationId, instanceId]);

  const handleRevert = async (change: ReservationChange) => {
    if (!reservationId || !change.field_name) return;

    try {
      let updateData: Record<string, unknown> = {};

      // Handle different field types
      switch (change.field_name) {
        case 'times':
          // Revert both start_time and end_time
          if (change.old_value) {
            updateData = {
              start_time: change.old_value.start_time,
              end_time: change.old_value.end_time,
            };
          }
          break;
        case 'dates':
          // Revert reservation_date
          if (change.old_value) {
            updateData = {
              reservation_date: change.old_value.reservation_date,
            };
          }
          break;
        default:
          // Standard single field revert
          updateData = {
            [change.field_name]: change.old_value,
          };
      }

      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId);

      if (error) throw error;

      // Close drawer and notify
      onClose();
      
      toast({
        title: 'Cofnięto zmianę',
        description: `Przywrócono poprzednią wartość pola`,
      });

      // Trigger refresh in parent
      onRevertSuccess?.();
    } catch (err) {
      console.error('Failed to revert change:', err);
      toast({
        title: 'Błąd',
        description: 'Nie udało się cofnąć zmiany',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[27rem] flex flex-col"
        hideCloseButton
        hideOverlay
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
                    onRevert={handleRevert}
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
