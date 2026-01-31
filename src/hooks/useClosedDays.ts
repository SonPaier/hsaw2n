import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ClosedDay {
  id: string;
  instance_id: string;
  closed_date: string;
  reason: string | null;
}

export const useClosedDays = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['closed_days', instanceId],
    queryFn: async (): Promise<ClosedDay[]> => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('closed_days')
        .select('*')
        .eq('instance_id', instanceId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 48 * 60 * 60 * 1000, // 48h
  });
};
