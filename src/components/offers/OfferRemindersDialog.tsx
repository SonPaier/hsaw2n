import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Bell, Trash2, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Reminder {
  id: string;
  service_name: string;
  scheduled_date: string;
  months_after: number;
  is_paid: boolean;
  service_type: string;
  status: string;
}

interface OfferRemindersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerNumber: string;
  customerName?: string;
}

export function OfferRemindersDialog({
  open,
  onOpenChange,
  offerId,
  offerNumber,
  customerName,
}: OfferRemindersDialogProps) {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    if (open) {
      loadReminders();
    }
  }, [open, offerId]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('offer_reminders')
        .select('id, service_name, scheduled_date, months_after, is_paid, service_type, status')
        .eq('offer_id', offerId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
      toast.error(t('offers.errors.loadRemindersError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('offer_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      setReminders(prev => prev.filter(r => r.id !== reminderId));
      toast.success(t('offers.reminderDeleted'));
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error(t('offers.errors.deleteReminderError'));
    }
  };

  const handleDeleteAllReminders = async () => {
    setDeletingAll(true);
    try {
      const { error } = await supabase
        .from('offer_reminders')
        .delete()
        .eq('offer_id', offerId);

      if (error) throw error;
      setReminders([]);
      toast.success(t('offers.allRemindersDeleted'));
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting all reminders:', error);
      toast.error(t('offers.errors.deleteRemindersError'));
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('offers.reminders')}
            </DialogTitle>
            <DialogDescription>
              {offerNumber} {customerName && `• ${customerName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : reminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>{t('offers.noReminders')}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {reminders.map((reminder) => (
                  <div 
                    key={reminder.id} 
                    className="flex items-start justify-between gap-3 p-3 border rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{reminder.service_name}</div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(reminder.scheduled_date), 'dd MMMM yyyy', { locale: pl })}
                        <span className="text-xs">({reminder.months_after} mies.)</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant={reminder.is_paid ? 'default' : 'outline'} 
                          className={`text-xs ${!reminder.is_paid ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
                        >
                          {reminder.is_paid ? t('offers.paid') : t('offers.free')}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {t(`offers.serviceTypes.${reminder.service_type}`, reminder.service_type)}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            reminder.status === 'completed' ? 'bg-green-50 text-green-700' : 
                            reminder.status === 'cancelled' ? 'bg-red-50 text-red-700' : ''
                          }`}
                        >
                          {t(`offers.reminderStatus.${reminder.status}`, reminder.status)}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteReminder(reminder.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {reminders.length > 0 && (
            <div className="flex justify-end pt-2 border-t">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('offers.deleteAllReminders')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('offers.confirmDeleteRemindersTitle')}
        description={t('offers.confirmDeleteRemindersDesc', { count: reminders.length })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        onConfirm={handleDeleteAllReminders}
      />
    </>
  );
}
