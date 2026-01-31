import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type WorkingHours = Record<string, { open: string; close: string } | null> | null;

export const useWorkingHours = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['working_hours', instanceId],
    queryFn: async (): Promise<WorkingHours> => {
      if (!instanceId) return null;
      const { data, error } = await supabase
        .from('instances')
        .select('working_hours')
        .eq('id', instanceId)
        .maybeSingle();
      
      if (error) throw error;
      return (data?.working_hours as WorkingHours) || null;
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 days
  });
};
