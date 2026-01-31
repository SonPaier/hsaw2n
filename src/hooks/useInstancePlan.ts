import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const query = useQuery({
    queryKey: ['instance_plan', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;

      const { data, error } = await supabase
        .from('instance_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('instance_id', instanceId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 days
  });

  const plan = useMemo(() => {
    if (!query.data?.subscription_plans) return null;
    const planData = query.data.subscription_plans as unknown as SubscriptionPlan;
    return {
      ...planData,
      included_features: Array.isArray(planData.included_features) 
        ? planData.included_features 
        : []
    };
  }, [query.data]);

  const subscription = useMemo(() => {
    if (!query.data) return null;
    return {
      id: query.data.id,
      instance_id: query.data.instance_id,
      plan_id: query.data.plan_id,
      station_limit: query.data.station_limit,
      monthly_price: query.data.monthly_price,
      starts_at: query.data.starts_at,
      ends_at: query.data.ends_at,
      status: query.data.status,
    } as InstanceSubscription;
  }, [query.data]);

  const includedFeatures = useMemo(() => plan?.included_features || [], [plan]);

  const hasFeature = useCallback((key: string): boolean => {
    return includedFeatures.includes(key);
  }, [includedFeatures]);

  const isFeatureFromPlan = useCallback((key: string): boolean => {
    return includedFeatures.includes(key);
  }, [includedFeatures]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    plan,
    subscription,
    planName: plan?.name || '',
    planSlug: plan?.slug || '',
    stationLimit: subscription?.station_limit || 2,
    monthlyPrice: subscription?.monthly_price || 0,
    smsLimit: plan?.sms_limit || 100,
    includedFeatures,
    hasFeature,
    isFeatureFromPlan,
    loading: query.isLoading,
    refetch,
  };
};
