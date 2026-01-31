import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OfferScope {
  id: string;
  name: string;
  short_name: string | null;
  is_extras_scope: boolean;
}

export const useOfferScopes = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['offer_scopes', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('offer_scopes')
        .select('id, name, short_name, is_extras_scope')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 days
  });
};
