import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that persists state in sessionStorage.
 * Useful for preserving UI state (like selected tabs) across browser tab switches
 * or when the browser kills the page process in the background.
 */
export function useSessionStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize from sessionStorage or use default
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Ignore parse errors
    }
    return defaultValue;
  });

  // Persist to sessionStorage whenever state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [key, state]);

  // Wrapper that matches useState signature
  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  return [state, setPersistedState];
}
