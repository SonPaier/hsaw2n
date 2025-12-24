import { useEffect, useCallback } from 'react';

interface UseWebOTPOptions {
  onCodeReceived: (code: string) => void;
  enabled?: boolean;
  timeoutMs?: number;
}

/**
 * Hook to use WebOTP API for automatic SMS code reading
 * Works on Android Chrome when SMS is formatted correctly:
 * "Your code is 1234.\n\n@domain.com #1234"
 */
export function useWebOTP({ 
  onCodeReceived, 
  enabled = true, 
  timeoutMs = 60000 
}: UseWebOTPOptions) {
  const isSupported = typeof window !== 'undefined' && 'OTPCredential' in window;

  const startListening = useCallback(async () => {
    if (!isSupported || !enabled) {
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const credential = await (navigator.credentials as any).get({
        otp: { transport: ['sms'] },
        signal: abortController.signal,
      });

      if (credential?.code) {
        console.log('WebOTP received code:', credential.code);
        onCodeReceived(credential.code);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('WebOTP timed out or was aborted');
      } else {
        console.log('WebOTP error:', error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [onCodeReceived, enabled, timeoutMs, isSupported]);

  useEffect(() => {
    if (enabled && isSupported) {
      startListening();
    }
  }, [enabled, isSupported, startListening]);

  return { isSupported };
}
