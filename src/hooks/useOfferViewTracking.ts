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

    // Generate ID client-side to avoid needing SELECT after INSERT
    const clientId = crypto.randomUUID();

    // Insert view record (fire-and-forget, no .select() needed)
    const insertView = async () => {
      const { error } = await supabase
        .from('offer_views')
        .insert({
          id: clientId,
          offer_id: offerId,
          instance_id: instanceId,
          is_admin_preview: isAdminPreview,
        });

      if (!error) {
        viewIdRef.current = clientId;
        startTimeRef.current = Date.now();
      } else {
        console.error('offer_views insert failed:', error.message);
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
