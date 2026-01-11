import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InstanceFeatures {
  offers: boolean;
  upsell: boolean;
  followup: boolean;
  sms_edit_link: boolean;
  hall_view: boolean;
}

interface FeatureWithParams {
  enabled: boolean;
  parameters: Record<string, unknown> | null;
}

const defaultFeatures: InstanceFeatures = {
  offers: false,
  upsell: false,
  followup: false,
  sms_edit_link: false,
  hall_view: false,
};

export const useInstanceFeatures = (instanceId: string | null) => {
  const [features, setFeatures] = useState<InstanceFeatures>(defaultFeatures);
  const [featureParams, setFeatureParams] = useState<Record<string, Record<string, unknown> | null>>({});
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    if (!instanceId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('instance_features')
        .select('feature_key, enabled, parameters')
        .eq('instance_id', instanceId);
      
      if (error) throw error;

      const featuresMap = { ...defaultFeatures };
      const paramsMap: Record<string, Record<string, unknown> | null> = {};
      
      (data || []).forEach(f => {
        if (f.feature_key in featuresMap) {
          (featuresMap as any)[f.feature_key] = f.enabled;
        }
        paramsMap[f.feature_key] = f.parameters as Record<string, unknown> | null;
      });
      
      setFeatures(featuresMap);
      setFeatureParams(paramsMap);
    } catch (error) {
      console.error('Error fetching instance features:', error);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const hasFeature = useCallback((featureKey: keyof InstanceFeatures): boolean => {
    return features[featureKey] ?? false;
  }, [features]);

  const getFeatureParams = useCallback((featureKey: string): Record<string, unknown> | null => {
    return featureParams[featureKey] || null;
  }, [featureParams]);

  return {
    features,
    loading,
    hasFeature,
    getFeatureParams,
    refetch: fetchFeatures,
  };
};
