import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// VAPID public key - must match the one in edge functions
const VAPID_PUBLIC_KEY = 'BAWbC044LI_A6_XGDmv9Q64Hbp2-k6LwCaiOMJaArlec3K2GQtmw3BQb9RclQLuZ0Zk2wiodBfbNxj6-xYkDlfA';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushSubscription = (instanceId: string | null) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      return !!subscription;
    } catch (error) {
      console.error('Error checking push subscription:', error);
      return false;
    }
  }, []);

  const subscribe = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    console.log('[Push] Starting subscription...', { user: !!user, instanceId });
    
    if (!user || !instanceId) {
      console.log('[Push] Missing user or instanceId');
      return { success: false, error: 'Not authenticated' };
    }

    if (!('serviceWorker' in navigator)) {
      console.log('[Push] Service Worker not supported');
      return { success: false, error: t('pushNotifications.notSupported') };
    }

    if (!('PushManager' in window)) {
      console.log('[Push] PushManager not supported');
      return { success: false, error: t('pushNotifications.notSupported') };
    }

    setIsLoading(true);

    try {
      // Request notification permission
      console.log('[Push] Requesting permission...');
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission result:', permission);
      
      if (permission !== 'granted') {
        setIsLoading(false);
        return { success: false, error: t('pushNotifications.permissionDenied') };
      }

      // Get service worker registration
      console.log('[Push] Getting SW registration...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push] SW ready:', registration.scope);

      // Subscribe to push
      console.log('[Push] Subscribing with VAPID key...');
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      console.log('[Push] Subscription created:', subscription.endpoint.substring(0, 50));
      const subscriptionJson = subscription.toJSON();

      // Save to database
      console.log('[Push] Saving to database...');
      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          instance_id: instanceId,
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys?.p256dh || '',
          auth: subscriptionJson.keys?.auth || '',
        }, { 
          onConflict: 'endpoint' 
        });

      if (dbError) {
        console.error('[Push] Error saving subscription:', dbError);
        setIsLoading(false);
        return { success: false, error: t('pushNotifications.enableError') };
      }

      console.log('[Push] Subscription saved successfully!');
      setIsSubscribed(true);
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      setIsLoading(false);
      return { success: false, error: t('pushNotifications.enableError') };
    }
  }, [user, instanceId, t]);

  const unsubscribe = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!('serviceWorker' in navigator)) {
      return { success: false, error: t('pushNotifications.notSupported') };
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database first
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);

        // Then unsubscribe
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      setIsLoading(false);
      return { success: false, error: 'Error unsubscribing' };
    }
  }, [t]);

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    checkSubscription,
    isSupported: 'serviceWorker' in navigator && 'PushManager' in window,
  };
};
