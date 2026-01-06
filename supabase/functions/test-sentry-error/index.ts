import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { captureException, captureMessage } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[test-sentry-error] Triggering test error for Sentry backend');
    
    // Create a test error
    const testError = new Error('🧪 TEST: Backend Sentry error from Edge Function');
    
    // Capture it to Sentry
    const eventId = await captureException(testError, {
      tags: { 
        test: 'true',
        source: 'test-sentry-error-function'
      },
      extra: {
        timestamp: new Date().toISOString(),
        purpose: 'Sentry backend integration test'
      },
      request: req
    });

    // Also send a test message
    await captureMessage('🧪 TEST: Backend Sentry message from Edge Function', 'warning', {
      tags: { test: 'true' }
    });

    console.log('[test-sentry-error] Error captured with eventId:', eventId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Backend error sent to Sentry',
      eventId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[test-sentry-error] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
