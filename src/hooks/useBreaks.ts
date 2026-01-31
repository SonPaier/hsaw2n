import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Break {
  id: string;
  instance_id: string;
  station_id: string | null;
  break_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

export const useBreaks = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['breaks', instanceId],
    queryFn: async (): Promise<Break[]> => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('breaks')
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
