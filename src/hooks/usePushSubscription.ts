import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// VAPID public key - must match the one in edge functions
const VAPID_PUBLIC_KEY = 'BIcdPzIvUSEiDnY3RuHYI835L6c3ocTWb2vvRRKpdxSX0tON8308iMUdM7eS4Vr6wWybrSlvJs7OqOTVED-UHe8';

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
    if (!user || !instanceId) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!('serviceWorker' in navigator)) {
      return { success: false, error: t('pushNotifications.notSupported') };
    }

    if (!('PushManager' in window)) {
      return { success: false, error: t('pushNotifications.notSupported') };
    }

    setIsLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setIsLoading(false);
        return { success: false, error: t('pushNotifications.permissionDenied') };
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subscriptionJson = subscription.toJSON();

      // Save to database
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
        console.error('Error saving push subscription:', dbError);
        setIsLoading(false);
        return { success: false, error: t('pushNotifications.enableError') };
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Error subscribing to push:', error);
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
