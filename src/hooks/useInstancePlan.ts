import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  price_per_station: number;
  sms_limit: number;
  included_features: string[];
  sort_order: number;
  active: boolean;
}

export interface InstanceSubscription {
  id: string;
  instance_id: string;
  plan_id: string;
  station_limit: number;
  monthly_price: number | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
}

export interface InstancePlanData {
  plan: SubscriptionPlan | null;
  subscription: InstanceSubscription | null;
  planName: string;
  planSlug: string;
  stationLimit: number;
  monthlyPrice: number;
  smsLimit: number;
  includedFeatures: string[];
  hasFeature: (key: string) => boolean;
  isFeatureFromPlan: (key: string) => boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useInstancePlan = (instanceId: string | null): InstancePlanData => {
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [subscription, setSubscription] = useState<InstanceSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!instanceId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch subscription with plan data
      const { data: subData, error: subError } = await supabase
        .from('instance_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('instance_id', instanceId)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      if (subData) {
        const planData = subData.subscription_plans as unknown as SubscriptionPlan;
        setPlan({
          ...planData,
          included_features: Array.isArray(planData.included_features) 
            ? planData.included_features 
            : []
        });
        setSubscription({
          id: subData.id,
          instance_id: subData.instance_id,
          plan_id: subData.plan_id,
          station_limit: subData.station_limit,
          monthly_price: subData.monthly_price,
          starts_at: subData.starts_at,
          ends_at: subData.ends_at,
          status: subData.status,
        });
      } else {
        setPlan(null);
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error fetching instance plan:', error);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasFeature = useCallback((key: string): boolean => {
    if (!plan) return false;
    return plan.included_features.includes(key);
  }, [plan]);

  const isFeatureFromPlan = useCallback((key: string): boolean => {
    if (!plan) return false;
    return plan.included_features.includes(key);
  }, [plan]);

  return {
    plan,
    subscription,
    planName: plan?.name || '',
    planSlug: plan?.slug || '',
    stationLimit: subscription?.station_limit || 2,
    monthlyPrice: subscription?.monthly_price || 0,
    smsLimit: plan?.sms_limit || 100,
    includedFeatures: plan?.included_features || [],
    hasFeature,
    isFeatureFromPlan,
    loading,
    refetch: fetchData,
  };
};
