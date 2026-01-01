import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Phone, Calendar, Search, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { AddCustomerToServiceDialog } from './AddCustomerToServiceDialog';

interface FollowUpService {
  id: string;
  name: string;
  description: string | null;
  default_interval_months: number;
}

interface FollowUpEvent {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  next_reminder_date: string;
  status: string;
  notes: string | null;
}

interface FollowUpServiceCustomersProps {
  instanceId: string;
  service: FollowUpService;
  onBack: () => void;
}

export function FollowUpServiceCustomers({
  instanceId,
  service,
  onBack,
}: FollowUpServiceCustomersProps) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<FollowUpEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('followup_events')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('followup_service_id', service.id)
        .eq('status', 'active')
        .order('next_reminder_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error(t('followup.fetchCustomersError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [instanceId, service.id]);

  const handleRemoveCustomer = async (eventId: string) => {
    if (!confirm(t('followup.confirmRemoveCustomer'))) return;

    try {
      const { error } = await supabase
        .from('followup_events')
        .update({ status: 'cancelled' })
        .eq('id', eventId);

      if (error) throw error;

      toast.success(t('followup.customerRemoved'));
      fetchEvents();
    } catch (error) {
      console.error('Error removing customer:', error);
      toast.error(t('followup.removeCustomerError'));
    }
  };

  const filteredEvents = events.filter(
    (event) =>
      event.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.customer_phone.includes(searchQuery)
  );

  const getDaysUntilReminder = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = new Date(date);
    reminderDate.setHours(0, 0, 0, 0);
    const diffTime = reminderDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getReminderBadgeColor = (days: number) => {
    if (days < 0) return 'bg-destructive text-destructive-foreground';
    if (days === 0) return 'bg-orange-500 text-white';
    if (days <= 7) return 'bg-yellow-500 text-black';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{service.name}</h2>
          <p className="text-sm text-muted-foreground">
            {t('followup.intervalLabel', { months: service.default_interval_months })}
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('followup.addCustomer')}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('followup.searchCustomer')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('followup.noCustomers')}</p>
            <p className="text-sm">{t('followup.addCustomersHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event) => {
            const daysUntil = getDaysUntilReminder(event.next_reminder_date);
            
            return (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{event.customer_name}</div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{event.customer_phone}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(event.next_reminder_date), 'd MMM yyyy', { locale: pl })}
                          </span>
                        </div>
                      </div>
                      {event.notes && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {event.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getReminderBadgeColor(daysUntil)}`}>
                        {daysUntil < 0
                          ? t('followup.daysAgo', { days: Math.abs(daysUntil) })
                          : daysUntil === 0
                          ? t('common.today')
                          : t('followup.inDays', { days: daysUntil })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCustomer(event.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddCustomerToServiceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        instanceId={instanceId}
        service={service}
        onSuccess={fetchEvents}
      />
    </div>
  );
}
