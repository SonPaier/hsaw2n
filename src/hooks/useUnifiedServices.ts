import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UnifiedService {
  id: string;
  name: string;
  short_name: string | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  price_from: number | null;
}

export const useUnifiedServices = (instanceId: string | null, serviceTypes: ('reservation' | 'both')[] = ['reservation', 'both']) => {
  return useQuery({
    queryKey: ['unified_services', instanceId, serviceTypes],
    queryFn: async (): Promise<UnifiedService[]> => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('unified_services')
        .select('id, name, short_name, price_small, price_medium, price_large, price_from')
        .eq('instance_id', instanceId)
        .in('service_type', serviceTypes);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 2 * 60 * 60 * 1000, // 2h
  });
};
