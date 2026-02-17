import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks offer view duration. Inserts a record on mount,
 * updates duration_seconds on visibilitychange/beforeunload.
 */
export function useOfferViewTracking(
  offerId: string | undefined,
  instanceId: string | undefined,
  isAdminPreview: boolean
) {
  const viewIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!offerId || !instanceId) return;

    // Insert view record
    const insertView = async () => {
      const { data } = await supabase
        .from('offer_views')
        .insert({
          offer_id: offerId,
          instance_id: instanceId,
          is_admin_preview: isAdminPreview,
        })
        .select('id')
        .single();

      if (data) {
        viewIdRef.current = data.id;
        startTimeRef.current = Date.now();
      }
    };

    insertView();

    const updateDuration = () => {
      if (!viewIdRef.current) return;
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      // Use sendBeacon-style: fire and forget
      supabase
        .from('offer_views')
        .update({ duration_seconds: seconds })
        .eq('id', viewIdRef.current)
        .then(() => {});
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        updateDuration();
      }
    };

    const handleBeforeUnload = () => {
      updateDuration();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      updateDuration();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [offerId, instanceId, isAdminPreview]);
}
