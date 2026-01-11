import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CalendarIcon, Bell, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReminderPreview {
  productName: string;
  reminders: {
    months: number;
    isPaid: boolean;
    serviceType: string;
    scheduledDate: Date;
  }[];
}

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
  const [previews, setPreviews] = useState<ReminderPreview[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  useEffect(() => {
    if (open) {
      loadReminderPreviews();
    }
  }, [open, offerId, completionDate]);

  const loadReminderPreviews = async () => {
    setLoadingPreviews(true);
    try {
      // Fetch selected options with products that have reminder templates
      const { data: options, error } = await supabase
        .from('offer_options')
        .select(`
          id,
          offer_option_items (
            id,
            product_id,
            custom_name,
            products_library (
              id,
              name,
              reminder_template_id,
              reminder_templates (
                id,
                name,
                items
              )
            )
          )
        `)
        .eq('offer_id', offerId)
        .eq('is_selected', true);

      if (error) throw error;

      const previewsMap = new Map<string, ReminderPreview>();

      for (const option of options || []) {
        for (const item of option.offer_option_items || []) {
          const product = item.products_library;
          if (!product?.reminder_template_id || !product.reminder_templates) continue;

          const template = product.reminder_templates;
          const items = (template.items as { months: number; is_paid: boolean; service_type: string }[]) || [];

          if (items.length === 0) continue;

          const productName = item.custom_name || product.name;
          const existing = previewsMap.get(product.id);

          if (!existing) {
            previewsMap.set(product.id, {
              productName,
              reminders: items.map(i => ({
                months: i.months,
                isPaid: i.is_paid,
                serviceType: i.service_type,
                scheduledDate: new Date(completionDate.getTime() + i.months * 30.44 * 24 * 60 * 60 * 1000),
              })),
            });
          }
        }
      }

      setPreviews(Array.from(previewsMap.values()));
    } catch (error) {
      console.error('Error loading reminder previews:', error);
    } finally {
      setLoadingPreviews(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Update offer status to completed
      const { error: updateError } = await supabase
        .from('offers')
        .update({
          status: 'completed',
          completed_at: completionDate.toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', offerId);

      if (updateError) throw updateError;

      // Call the database function to create reminders
      const { data: reminderCount, error: rpcError } = await supabase.rpc('create_offer_reminders', {
        p_offer_id: offerId,
        p_completed_at: completionDate.toISOString(),
      });

      if (rpcError) {
        console.error('Error creating reminders:', rpcError);
        // Don't throw - offer is still completed even if reminders fail
      }

      toast.success(t('offers.markedAsCompleted', { count: reminderCount || 0 }));
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      console.error('Error marking offer as completed:', error);
      toast.error(t('offers.errors.completionError'));
    } finally {
      setLoading(false);
    }
  };

  const totalReminders = previews.reduce((sum, p) => sum + p.reminders.length, 0);

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
          {/* Date picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('offers.completionDate')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
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

          {/* Reminders preview */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('offers.remindersToCreate')}</span>
              <Badge variant="secondary">{totalReminders}</Badge>
            </div>

            {loadingPreviews ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : previews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {t('offers.noRemindersToCreate')}
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {previews.map((preview, idx) => (
                  <div key={idx} className="text-sm border rounded-lg p-3">
                    <div className="font-medium mb-2">{preview.productName}</div>
                    <div className="space-y-1">
                      {preview.reminders.map((r, rIdx) => (
                        <div key={rIdx} className="flex items-center justify-between text-muted-foreground">
                          <span>
                            {r.months} mies. - {t(`offers.serviceTypes.${r.serviceType}`, r.serviceType)}
                          </span>
                          <Badge 
                            variant={r.isPaid ? 'default' : 'outline'} 
                            className={cn('text-xs', r.isPaid ? '' : 'bg-green-50 text-green-700 border-green-200')}
                          >
                            {r.isPaid ? t('offers.paid') : t('offers.free')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
