import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";

let sentryInitialized = false;

export const initSentry = async () => {
  if (sentryInitialized) return;
  
  try {
    // Fetch DSN from edge function (secure way to get secret)
    const { data, error } = await supabase.functions.invoke('get-public-config');
    
    if (error) {
      console.warn('[Sentry] Failed to fetch config:', error.message);
      return;
    }
    
    const dsn = data?.sentryDsn;
    
    if (!dsn) {
      console.warn('[Sentry] DSN not configured, error tracking disabled');
      return;
    }

    Sentry.init({
      dsn,
      
      // Environment detection
      environment: import.meta.env.PROD ? 'production' : 'development',
      
      // Enable performance monitoring
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      
      // Performance Monitoring - sample 10% of transactions in production
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      
      // Session Replay - sample 10% of sessions, 100% on error
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Filter out noisy errors
      ignoreErrors: [
        // Browser extensions
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Network errors that are expected
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        // User aborted requests
        'AbortError',
      ],
      
      // Don't send errors in development by default
      enabled: import.meta.env.PROD,
      
      // Add useful context
      beforeSend(event) {
        // Add hostname info for multi-tenant debugging
        event.tags = {
          ...event.tags,
          hostname: window.location.hostname,
        };
        return event;
      },
    });
    
    sentryInitialized = true;
    console.log('[Sentry] Initialized for', import.meta.env.PROD ? 'production' : 'development');
  } catch (err) {
    console.warn('[Sentry] Initialization failed:', err);
  }
};

// Helper to capture errors with additional context
export const captureError = (error: Error, context?: Record<string, unknown>) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

// Helper to capture backend/HTTP errors (400, 500, RPC errors, etc.)
export const captureBackendError = (
  operation: string,
  error: { code?: string; message?: string; details?: unknown },
  context?: Record<string, unknown>
) => {
  const err = new Error(`[${operation}] ${error.message || 'Unknown backend error'}`);
  Sentry.captureException(err, {
    tags: {
      error_code: error.code || 'unknown',
      operation,
      error_type: 'backend_error',
    },
    extra: {
      ...context,
      error_details: error.details,
      original_error: error,
    },
  });
};

// Helper to capture messages
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};

// Set user context after login
export const setSentryUser = (user: { id: string; email?: string; role?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
};

// Clear user context on logout
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

// Add instance context for multi-tenant debugging
export const setSentryInstanceContext = (instanceId: string, instanceSlug: string) => {
  Sentry.setTag('instance_id', instanceId);
  Sentry.setTag('instance_slug', instanceSlug);
};
