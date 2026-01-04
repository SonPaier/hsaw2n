import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, title, body, url, tag, icon } = await req.json();

    console.log(`[send-push] Received request for instanceId: ${instanceId}`);
    console.log(`[send-push] Title: ${title}, Body: ${body}`);

    if (!instanceId) {
      console.error('[send-push] Missing instanceId');
      return new Response(
        JSON.stringify({ error: 'Missing instanceId', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidEmail = Deno.env.get('VAPID_EMAIL');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      console.error('[send-push] VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all subscriptions for this instance
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('instance_id', instanceId);

    if (subError) {
      console.error('[send-push] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Error fetching subscriptions', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[send-push] Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sent = 0;
    const staleSubscriptionIds: string[] = [];
    const errors: string[] = [];

    // Send to each subscription using simple push (triggers fetch in SW)
    for (const sub of subscriptions) {
      try {
        console.log(`[send-push] Sending to endpoint: ${sub.endpoint.substring(0, 80)}...`);
        
        // For Web Push without encryption, we send an empty body
        // This triggers the push event in the service worker
        // The SW will show a default notification
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'TTL': '86400',
            'Urgency': 'high',
            'Content-Length': '0',
          },
        });

        console.log(`[send-push] Response status: ${response.status}`);

        if (response.ok || response.status === 201) {
          sent++;
          console.log(`[send-push] Successfully sent to subscription ${sub.id}`);
        } else if (response.status === 410 || response.status === 404) {
          // Subscription is stale
          console.log(`[send-push] Stale subscription: ${sub.id}`);
          staleSubscriptionIds.push(sub.id);
        } else {
          const errorText = await response.text();
          console.error(`[send-push] Failed with status ${response.status}: ${errorText}`);
          errors.push(`${response.status}: ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.error(`[send-push] Error sending to ${sub.endpoint}:`, error);
        errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Remove stale subscriptions
    if (staleSubscriptionIds.length > 0) {
      console.log(`[send-push] Removing ${staleSubscriptionIds.length} stale subscriptions`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', staleSubscriptionIds);
    }

    console.log(`[send-push] Processed ${subscriptions.length} subscriptions, sent: ${sent}`);

    return new Response(
      JSON.stringify({ 
        sent, 
        total: subscriptions.length,
        staleRemoved: staleSubscriptionIds.length,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-push] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, sent: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
