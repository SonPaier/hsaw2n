import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InstanceFeatures {
  offers: boolean;
  upsell: boolean;
  // Add more features here as needed
}

const defaultFeatures: InstanceFeatures = {
  offers: false,
  upsell: false,
};

export const useInstanceFeatures = (instanceId: string | null) => {
  const [features, setFeatures] = useState<InstanceFeatures>(defaultFeatures);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    if (!instanceId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('instance_features')
        .select('feature_key, enabled')
        .eq('instance_id', instanceId);
      
      if (error) throw error;

      const featuresMap = { ...defaultFeatures };
      (data || []).forEach(f => {
        if (f.feature_key in featuresMap) {
          (featuresMap as any)[f.feature_key] = f.enabled;
        }
      });
      
      setFeatures(featuresMap);
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

  return {
    features,
    loading,
    hasFeature,
    refetch: fetchFeatures,
  };
};
