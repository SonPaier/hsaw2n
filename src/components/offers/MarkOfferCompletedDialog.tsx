import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MarkOfferCompletedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerNumber: string;
  onCompleted: () => void;
}

export function MarkOfferCompletedDialog({
  open,
  onOpenChange,
  offerId,
  offerNumber,
  onCompleted,
}: MarkOfferCompletedDialogProps) {
  const { t } = useTranslation();
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('offers')
        .update({
          status: 'completed',
          completed_at: completionDate.toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', offerId);

      if (updateError) throw updateError;

      toast.success(t('offers.markedAsCompleted', { count: 0 }));
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      console.error('Error marking offer as completed:', error);
      toast.error(t('offers.errors.completionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('offers.markAsCompleted')}</DialogTitle>
          <DialogDescription>
            {t('offers.markAsCompletedDesc', { number: offerNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('offers.completionDate')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal bg-white"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(completionDate, 'dd MMMM yyyy', { locale: pl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={completionDate}
                  onSelect={(date) => date && setCompletionDate(date)}
                  locale={pl}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('offers.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
