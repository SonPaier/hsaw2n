import { useState, useEffect, useCallback } from 'react';
import { VERSION_STORAGE_KEY } from '@/lib/version';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const checkServerVersion = async () => {
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
    };

    checkServerVersion();

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
  }, []);

  const applyUpdate = useCallback(async () => {
    setIsUpdating(true);
    
    try {
      // Update stored version with the latest from server
      if (latestVersion) {
        localStorage.setItem(VERSION_STORAGE_KEY, latestVersion);
      }
      
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
  }, [latestVersion]);

  return {
    updateAvailable,
    isUpdating,
    applyUpdate,
    currentVersion: latestVersion
  };
}
