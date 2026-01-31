import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkersSettings {
  instance_id: string;
  start_stop_enabled: boolean;
  overtime_enabled: boolean;
  standard_hours_per_day: number;
  report_frequency: 'monthly' | 'weekly';
}

export const useWorkersSettings = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['workers-settings', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      
      const { data, error } = await supabase
        .from('workers_settings')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle();
      
      if (error) throw error;
      return data as WorkersSettings | null;
    },
    enabled: !!instanceId,
  });
};

export const useUpdateWorkersSettings = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Partial<Omit<WorkersSettings, 'instance_id'>>) => {
      if (!instanceId) throw new Error('No instance ID');
      
      const { error } = await supabase
        .from('workers_settings')
        .upsert({ 
          instance_id: instanceId, 
          ...settings 
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers-settings', instanceId] });
    },
  });
};
