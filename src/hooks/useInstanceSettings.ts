import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstanceSettings {
  assign_employees_to_stations: boolean;
  assign_employees_to_reservations: boolean;
}

export const useInstanceSettings = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['instanceSettings', instanceId],
    queryFn: async (): Promise<InstanceSettings | null> => {
      if (!instanceId) return null;
      
      const { data, error } = await supabase
        .from('instances')
        .select('assign_employees_to_stations, assign_employees_to_reservations')
        .eq('id', instanceId)
        .single();
      
      if (error) throw error;
      return {
        assign_employees_to_stations: data?.assign_employees_to_stations ?? false,
        assign_employees_to_reservations: data?.assign_employees_to_reservations ?? false,
      };
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000, // 5 minutes - rarely changes
  });
};

export const useUpdateInstanceSettings = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  const updateSetting = async (key: keyof InstanceSettings, value: boolean) => {
    if (!instanceId) throw new Error('No instance ID');
    
    const { error } = await supabase
      .from('instances')
      .update({ [key]: value })
      .eq('id', instanceId);
    
    if (error) throw error;
    
    // Invalidate cache
    queryClient.invalidateQueries({ queryKey: ['instanceSettings', instanceId] });
    queryClient.invalidateQueries({ queryKey: ['instance_data', instanceId] });
  };
  
  return { updateSetting };
};
