import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION, VERSION_STORAGE_KEY } from '@/lib/version';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Check if we have a stored version
    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    
    if (storedVersion && storedVersion !== APP_VERSION) {
      // New version available
      setUpdateAvailable(true);
    } else if (!storedVersion) {
      // First time - store current version
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    }

    // Also listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker installed, update available
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      // Check for updates periodically (every 30 minutes)
      const checkInterval = setInterval(() => {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update();
        });
      }, 30 * 60 * 1000);

      return () => clearInterval(checkInterval);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    setIsUpdating(true);
    
    try {
      // Update stored version
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      
      // If service worker is available, tell it to skip waiting
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }

      // Clear caches if possible
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Force reload from server
      window.location.reload();
    } catch (error) {
      console.error('Error applying update:', error);
      // Fallback - just reload
      window.location.reload();
    }
  }, []);

  return {
    updateAvailable,
    isUpdating,
    applyUpdate,
    currentVersion: APP_VERSION
  };
}
