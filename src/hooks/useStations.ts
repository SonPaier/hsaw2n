import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Station {
  id: string;
  name: string;
  type: string;
}

export const useStations = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['stations', instanceId],
    queryFn: async (): Promise<Station[]> => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, type')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 48 * 60 * 60 * 1000, // 48h
  });
};
