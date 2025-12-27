import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FollowUpTasks } from '@/components/followup/FollowUpTasks';
import { FollowUpServices } from '@/components/followup/FollowUpServices';
import { Loader2 } from 'lucide-react';

export default function FollowUpPage() {
  const { user } = useAuth();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInstanceId = async () => {
      if (!user?.id) return;
      
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('instance_id')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData?.instance_id) {
          setInstanceId(roleData.instance_id);
        }
      } catch (error) {
        console.error('Error fetching instance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstanceId();
  }, [user?.id]);

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
        Brak dostępu do instancji
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Follow-up</h1>
        <p className="text-muted-foreground">Zarządzaj usługami cyklicznymi i przypomnieniami</p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">Zadania</TabsTrigger>
          <TabsTrigger value="services">Usługi cykliczne</TabsTrigger>
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
