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

    console.log(`Sending push notification for instance: ${instanceId}`);
    console.log(`Title: ${title}, Body: ${body}`);

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidEmail = Deno.env.get('VAPID_EMAIL');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      console.error('VAPID keys not configured');
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
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Error fetching subscriptions', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare payload - simple JSON for now
    // Note: For production, you'd want to use web-push encryption
    // But many browsers accept unencrypted payloads for testing
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/admin',
      tag: tag || 'notification',
      icon: icon || '/pwa-192x192.png',
    });

    let sent = 0;
    const staleSubscriptionIds: string[] = [];

    // Send to each subscription using simple fetch
    // This is a simplified implementation - full web-push requires encryption
    for (const sub of subscriptions) {
      try {
        // For now, just log - actual push requires web-push library or encryption
        console.log(`Would send to: ${sub.endpoint}`);
        
        // Try sending without encryption (some endpoints accept this)
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
          },
          body: payload,
        });

        console.log(`Push response: ${response.status}`);

        if (response.ok || response.status === 201) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription is stale
          staleSubscriptionIds.push(sub.id);
        }
      } catch (error) {
        console.error(`Error sending to ${sub.endpoint}:`, error);
      }
    }

    // Remove stale subscriptions
    if (staleSubscriptionIds.length > 0) {
      console.log(`Removing ${staleSubscriptionIds.length} stale subscriptions`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', staleSubscriptionIds);
    }

    console.log(`Processed ${subscriptions.length} subscriptions, sent indicator: ${sent}`);

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, sent: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
