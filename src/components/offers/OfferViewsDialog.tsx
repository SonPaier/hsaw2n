import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface OfferView {
  id: string;
  started_at: string;
  duration_seconds: number;
  is_admin_preview: boolean;
}

interface OfferViewsDialogProps {
  offerId: string;
  viewedAt?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return '< 1 s';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec} s`;
  return `${min} min ${sec} s`;
};

export const OfferViewsDialog = ({ offerId, viewedAt, open, onOpenChange }: OfferViewsDialogProps) => {
  const { t } = useTranslation();
  const [views, setViews] = useState<OfferView[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('offer_views')
      .select('id, started_at, duration_seconds, is_admin_preview')
      .eq('offer_id', offerId)
      .eq('is_admin_preview', false)
      .order('started_at', { ascending: false })
      .then(({ data }) => {
        setViews((data as OfferView[]) || []);
        setLoading(false);
      });
  }, [open, offerId]);

  const totalViews = views.length;
  const totalSeconds = views.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {t('offers.viewHistory', 'Historia oglądania')}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : views.length > 0 ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <span>{t('offers.viewCount', 'Wyświetlenia')}: <strong className="text-foreground">{totalViews}</strong></span>
              <span>{t('offers.totalTime', 'Łączny czas')}: <strong className="text-foreground">{formatDuration(totalSeconds)}</strong></span>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {views.map((view) => (
                <div key={view.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span className="text-foreground">
                    {format(new Date(view.started_at), 'd MMM, HH:mm', { locale: pl })}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(view.duration_seconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : viewedAt ? (
          <p className="text-sm text-muted-foreground py-4">
            {t('offers.noViewData', 'Obejrzana')} {format(new Date(viewedAt), 'd MMMM yyyy, HH:mm', { locale: pl })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            {t('offers.noViewData', 'Brak danych o oglądaniu')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
