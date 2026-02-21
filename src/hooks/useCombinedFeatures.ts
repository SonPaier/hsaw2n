import { useCallback } from 'react';
import { useInstanceFeatures } from './useInstanceFeatures';
import { useInstancePlan } from './useInstancePlan';

type FeatureKey = 'offers' | 'upsell' | 'followup' | 'sms_edit_link' | 'hall_view' | 'vehicle_reception_protocol' | 'trainings' | 'sales_crm';

/**
 * Combined feature check hook that checks both:
 * 1. Plan features (from subscription_plans.included_features)
 * 2. Instance features (from instance_features table)
 * 
 * A feature is considered enabled if it's in EITHER source.
 */
export const useCombinedFeatures = (instanceId: string | null) => {
  const { hasFeature: hasInstanceFeature, getFeatureParams, loading: instanceFeaturesLoading, refetch: refetchInstanceFeatures } = useInstanceFeatures(instanceId);
  const { hasFeature: hasPlanFeature, loading: planLoading, refetch: refetchPlan } = useInstancePlan(instanceId);

  const hasFeature = useCallback((key: FeatureKey): boolean => {
    return hasPlanFeature(key) || hasInstanceFeature(key);
  }, [hasPlanFeature, hasInstanceFeature]);

  const refetch = useCallback(async () => {
    await Promise.all([refetchInstanceFeatures(), refetchPlan()]);
  }, [refetchInstanceFeatures, refetchPlan]);

  return {
    hasFeature,
    getFeatureParams,
    loading: instanceFeaturesLoading || planLoading,
    refetch,
  };
};
