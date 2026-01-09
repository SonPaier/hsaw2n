import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FollowUpTasks } from '@/components/followup/FollowUpTasks';
import { FollowUpServices } from '@/components/followup/FollowUpServices';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface FollowUpViewProps {
  instanceId: string | null;
}

export default function FollowUpView({ instanceId }: FollowUpViewProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  // Auto-generate tasks for events with reminder date = today
  useEffect(() => {
    const generateTodayTasks = async () => {
      if (!instanceId) {
        setLoading(false);
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');

      try {
        // Get all events with reminder date = today that don't have a pending task yet
        const { data: events, error: eventsError } = await supabase
          .from('followup_events')
          .select(`
            id,
            customer_name,
            customer_phone,
            next_reminder_date,
            followup_services (name)
          `)
          .eq('instance_id', instanceId)
          .eq('status', 'active')
          .eq('next_reminder_date', today);

        if (eventsError) throw eventsError;
        if (!events || events.length === 0) {
          setLoading(false);
          return;
        }

        // Check which events already have pending tasks for today
        const eventIds = events.map(e => e.id);
        const { data: existingTasks } = await supabase
          .from('followup_tasks')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('status', 'pending')
          .eq('due_date', today);

        const existingEventIds = new Set((existingTasks || []).map(t => t.event_id));

        // Create tasks for events that don't have one
        const newTasks = events
          .filter(e => !existingEventIds.has(e.id))
          .map(e => ({
            instance_id: instanceId,
            event_id: e.id,
            customer_name: e.customer_name,
            customer_phone: e.customer_phone,
            due_date: today,
            title: (e.followup_services as any)?.name || 'Follow-up',
            status: 'pending',
          }));

        if (newTasks.length > 0) {
          const { error: insertError } = await supabase
            .from('followup_tasks')
            .insert(newTasks);
          
          if (insertError) {
            console.error('Error creating tasks:', insertError);
          }
        }
      } catch (error) {
        console.error('Error generating tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    generateTodayTasks();
  }, [instanceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!instanceId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('followupPage.noAccess')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('followupPage.title')}</h1>
        <p className="text-muted-foreground">{t('followupPage.description')}</p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">{t('followupPage.tabs.tasks')}</TabsTrigger>
          <TabsTrigger value="services">{t('followupPage.tabs.services')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="mt-4">
          <FollowUpTasks instanceId={instanceId} />
        </TabsContent>
        
        <TabsContent value="services" className="mt-4">
          <FollowUpServices instanceId={instanceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
