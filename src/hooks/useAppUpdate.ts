import { useState, useEffect, useCallback } from 'react';
import { VERSION_STORAGE_KEY } from '@/lib/version';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    try {
      // Cache-busting query param to always get fresh version
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to fetch version');
      
      const data = await res.json();
      const serverVersion = data.version;
      setLatestVersion(serverVersion);
      
      const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
      
      if (storedVersion && storedVersion !== serverVersion) {
        // New version available
        setUpdateAvailable(true);
      } else if (!storedVersion) {
        // First time - store current version
        localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
      }
    } catch (error) {
      console.error('Failed to check version:', error);
    }
  }, []);

  useEffect(() => {
    // Check on mount
    checkForUpdate();

    // Check every 1 hour for updates
    const interval = setInterval(checkForUpdate, 60 * 60 * 1000);

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
    }

    return () => clearInterval(interval);
  }, [checkForUpdate]);

  const applyUpdate = useCallback(async () => {
    setIsUpdating(true);
    console.log('[Update] Starting update process...');
    
    try {
      // Update stored version with the latest from server
      if (latestVersion) {
        localStorage.setItem(VERSION_STORAGE_KEY, latestVersion);
        console.log('[Update] Version saved:', latestVersion);
      }
      
      // If service worker is available, tell it to skip waiting
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            console.log('[Update] SW skip waiting sent');
          }
        } catch (swError) {
          console.warn('[Update] SW error (continuing):', swError);
        }
      }

      // Clear caches with timeout (max 3 seconds)
      if ('caches' in window) {
        try {
          const cachePromise = (async () => {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('[Update] Caches cleared:', cacheNames.length);
          })();
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cache clear timeout')), 3000)
          );
          
          await Promise.race([cachePromise, timeoutPromise]);
        } catch (cacheError) {
          console.warn('[Update] Cache clear skipped:', cacheError);
        }
      }
    } catch (error) {
      console.error('[Update] Error during update:', error);
    }
    
    // Always reload, regardless of any errors above
    console.log('[Update] Reloading...');
    window.location.reload();
  }, [latestVersion]);

  return {
    updateAvailable,
    isUpdating,
    applyUpdate,
    checkForUpdate,
    currentVersion: latestVersion
  };
}
