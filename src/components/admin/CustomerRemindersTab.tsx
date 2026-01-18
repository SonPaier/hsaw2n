import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Bell, Trash2, Loader2, Calendar, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AddCustomerReminderDialog } from './AddCustomerReminderDialog';

interface Reminder {
  id: string;
  service_name: string;
  scheduled_date: string;
  months_after: number;
  is_paid: boolean;
  service_type: string;
  status: string;
  offer_id: string | null;
  offer_number?: string | null;
}

interface CustomerRemindersTabProps {
  customerPhone: string;
  customerName: string;
  instanceId: string;
}

export function CustomerRemindersTab({ 
  customerPhone, 
  customerName,
  instanceId 
}: CustomerRemindersTabProps) {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteReminderDialog, setDeleteReminderDialog] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    loadReminders();
  }, [customerPhone, instanceId]);

  const loadReminders = async () => {
    if (!customerPhone || !instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('offer_reminders')
        .select(`
          id, 
          service_name, 
          scheduled_date, 
          months_after, 
          is_paid, 
          service_type, 
          status,
          offer_id,
          offers(offer_number)
        `)
        .eq('customer_phone', customerPhone)
        .eq('instance_id', instanceId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      
      setReminders((data || []).map(r => ({
        ...r,
        offer_number: r.offers ? (r.offers as any).offer_number : null
      })));
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
      toast.success(t('customers.reminderDeleted'));
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error(t('offers.errors.deleteReminderError'));
    }
  };

  const handleReminderAdded = () => {
    loadReminders();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with add button */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {t('customers.reminders')}
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            {t('customers.addReminder')}
          </Button>
        </div>

        {/* Reminders list */}
        {reminders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{t('customers.noReminders')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div 
                key={reminder.id} 
                className="flex items-start justify-between gap-3 p-3 border rounded-lg bg-white"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{reminder.service_name}</div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(reminder.scheduled_date), 'dd MMMM yyyy', { locale: pl })}
                    {reminder.months_after > 0 && (
                      <span className="text-xs">({reminder.months_after} mies.)</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Offer or Custom badge */}
                    {reminder.offer_id && reminder.offer_number ? (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {reminder.offer_number}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {t('customers.customReminder')}
                      </Badge>
                    )}
                    
                    {/* Paid/Free badge */}
                    <Badge 
                      variant={reminder.is_paid ? 'default' : 'outline'} 
                      className={`text-xs ${!reminder.is_paid ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
                    >
                      {reminder.is_paid ? t('offers.paid') : t('offers.free')}
                    </Badge>
                    
                    {/* Service type badge */}
                    <Badge variant="secondary" className="text-xs">
                      {t(`offers.serviceTypes.${reminder.service_type}`, reminder.service_type)}
                    </Badge>
                    
                    {/* Status badge */}
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
                  onClick={() => setDeleteReminderDialog(reminder.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteReminderDialog}
        onOpenChange={(open) => !open && setDeleteReminderDialog(null)}
        title={t('offers.confirmDeleteReminderTitle')}
        description={t('offers.confirmDeleteReminderDesc')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        onConfirm={() => {
          if (deleteReminderDialog) {
            handleDeleteReminder(deleteReminderDialog);
            setDeleteReminderDialog(null);
          }
        }}
      />

      {/* Add reminder dialog */}
      <AddCustomerReminderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        customerPhone={customerPhone}
        customerName={customerName}
        instanceId={instanceId}
        onReminderAdded={handleReminderAdded}
      />
    </>
  );
}
