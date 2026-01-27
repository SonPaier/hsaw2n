import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Bell, Trash2, Loader2, Calendar, Plus, Car, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AddCustomerReminderDialog } from './AddCustomerReminderDialog';

interface Reminder {
  id: string;
  scheduled_date: string;
  months_after: number;
  service_type: string;
  status: string;
  sent_at: string | null;
  vehicle_plate: string;
  reminder_template_id: string;
  reminder_templates: { name: string } | null;
}

interface GroupedReminder {
  templateId: string;
  templateName: string;
  vehiclePlate: string;
  reminders: Reminder[];
  nextReminder: Reminder;
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
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpansion = (groupKey: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Group reminders by template + vehicle
  const groupedReminders = useMemo(() => {
    const groups: Record<string, GroupedReminder> = {};
    
    for (const reminder of reminders) {
      const key = `${reminder.reminder_template_id}_${reminder.vehicle_plate}`;
      
      if (!groups[key]) {
        groups[key] = {
          templateId: reminder.reminder_template_id,
          templateName: reminder.reminder_templates?.name || t('customers.customReminder'),
          vehiclePlate: reminder.vehicle_plate,
          reminders: [],
          nextReminder: reminder
        };
      }
      
      groups[key].reminders.push(reminder);
      
      // Update next reminder (earliest scheduled, not sent)
      if (reminder.status !== 'sent' && 
          new Date(reminder.scheduled_date) < new Date(groups[key].nextReminder.scheduled_date)) {
        groups[key].nextReminder = reminder;
      }
    }
    
    // Sort reminders within each group by date
    Object.values(groups).forEach(group => {
      group.reminders.sort((a, b) => 
        new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );
    });
    
    return Object.values(groups);
  }, [reminders, t]);

  useEffect(() => {
    loadReminders();
  }, [customerPhone, instanceId]);

  const loadReminders = async () => {
    if (!customerPhone || !instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_reminders')
        .select(`
          id, 
          scheduled_date, 
          months_after, 
          service_type, 
          status,
          sent_at,
          vehicle_plate,
          reminder_template_id,
          reminder_templates(name)
        `)
        .eq('customer_phone', customerPhone)
        .eq('instance_id', instanceId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      
      setReminders((data || []) as Reminder[]);
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
        .from('customer_reminders')
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-50 text-green-700';
      case 'cancelled': return 'bg-red-50 text-red-700';
      case 'failed': return 'bg-orange-50 text-orange-700';
      default: return '';
    }
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

        {/* Reminders list - grouped by template */}
        {groupedReminders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{t('customers.noReminders')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedReminders.map((group) => {
              const groupKey = `${group.templateId}_${group.vehiclePlate}`;
              const nextReminder = group.nextReminder;
              
              return (
                <div 
                  key={groupKey} 
                  className="p-3 border rounded-lg bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {group.templateName}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(nextReminder.scheduled_date), 'dd MMMM yyyy', { locale: pl })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Vehicle plate */}
                        {group.vehiclePlate && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {group.vehiclePlate}
                          </Badge>
                        )}
                        
                        {/* Service type badge */}
                        <Badge variant="secondary" className="text-xs">
                          {t(`offers.serviceTypes.${nextReminder.service_type}`, nextReminder.service_type)}
                        </Badge>
                        
                        {/* Status badge */}
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusBadgeClass(nextReminder.status)}`}
                        >
                          {t(`offers.reminderStatus.${nextReminder.status}`, nextReminder.status)}
                        </Badge>
                        
                        {/* Months badge */}
                        {nextReminder.months_after > 0 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {nextReminder.months_after} mies.
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible SMS list */}
                  <Collapsible 
                    open={expandedCards[groupKey]} 
                    onOpenChange={() => toggleCardExpansion(groupKey)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline mt-3">
                      {expandedCards[groupKey] ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      <MessageSquare className="w-4 h-4" />
                      <span>{t('customers.viewRemindersList')} ({group.reminders.length})</span>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="mt-3 space-y-2">
                      {group.reminders.map((reminder) => (
                        <div 
                          key={reminder.id}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border w-full text-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>
                                {t('customers.smsScheduledAt', { 
                                  date: format(new Date(reminder.scheduled_date), 'dd.MM.yyyy', { locale: pl }) 
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getStatusBadgeClass(reminder.status)}`}
                              >
                                {t(`offers.reminderStatus.${reminder.status}`, reminder.status)}
                              </Badge>
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                {reminder.months_after} mies.
                              </Badge>
                              {reminder.sent_at && (
                                <span className="text-xs text-muted-foreground">
                                  ({format(new Date(reminder.sent_at), 'dd.MM.yyyy HH:mm', { locale: pl })})
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteReminderDialog(reminder.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
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
