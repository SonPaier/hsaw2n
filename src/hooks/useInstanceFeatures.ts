import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface InstanceFeatures {
  offers: boolean;
  upsell: boolean;
  followup: boolean;
  sms_edit_link: boolean;
  hall_view: boolean;
  vehicle_reception_protocol: boolean;
  reminders: boolean;
}

const defaultFeatures: InstanceFeatures = {
  offers: false,
  upsell: false,
  followup: false,
  sms_edit_link: false,
  hall_view: false,
  vehicle_reception_protocol: false,
  reminders: false,
};

export const useInstanceFeatures = (instanceId: string | null) => {
  const query = useQuery({
    queryKey: ['instance_features', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('instance_features')
        .select('feature_key, enabled, parameters')
        .eq('instance_id', instanceId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 days
  });

  const { features, featureParams } = useMemo(() => {
    const featuresMap = { ...defaultFeatures };
    const paramsMap: Record<string, Record<string, unknown> | null> = {};
    
    (query.data || []).forEach(f => {
      if (f.feature_key in featuresMap) {
        (featuresMap as any)[f.feature_key] = f.enabled;
      }
      paramsMap[f.feature_key] = f.parameters as Record<string, unknown> | null;
    });
    
    return { features: featuresMap, featureParams: paramsMap };
  }, [query.data]);

  const hasFeature = useCallback((featureKey: keyof InstanceFeatures): boolean => {
    return features[featureKey] ?? false;
  }, [features]);

  const getFeatureParams = useCallback((featureKey: string): Record<string, unknown> | null => {
    return featureParams[featureKey] || null;
  }, [featureParams]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    features,
    loading: query.isLoading,
    hasFeature,
    getFeatureParams,
    refetch,
  };
};
