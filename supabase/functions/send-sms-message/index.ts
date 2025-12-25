import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsRequest {
  phone: string;
  message: string;
  instanceId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, instanceId }: SmsRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "Phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check SMS limit if instanceId is provided
    if (instanceId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.2");
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: canSend, error: limitCheckError } = await supabase
        .rpc('check_sms_available', { _instance_id: instanceId });

      if (limitCheckError) {
        console.error("SMS limit check error:", limitCheckError);
        return new Response(
          JSON.stringify({ error: "Failed to check SMS limit" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!canSend) {
        console.log(`SMS limit exceeded for instance ${instanceId}`);
        return new Response(
          JSON.stringify({ error: "SMS limit exceeded", code: "SMS_LIMIT_EXCEEDED" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      if (normalizedPhone.startsWith("48")) {
        normalizedPhone = "+" + normalizedPhone;
      } else {
        normalizedPhone = "+48" + normalizedPhone;
      }
    }

    const SMSAPI_TOKEN = Deno.env.get("SMSAPI_TOKEN");

    if (!SMSAPI_TOKEN) {
      console.log(`[DEV MODE] Would send SMS to ${normalizedPhone}: ${message}`);
      return new Response(
        JSON.stringify({ success: true, message: "SMS simulated (dev mode)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via SMSAPI
    const smsResponse = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SMSAPI_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        to: normalizedPhone,
        message: message,
        format: "json",
        encoding: "utf-8",
      }),
    });

    const smsResult = await smsResponse.json();

    if (smsResult.error) {
      console.error("SMSAPI error:", smsResult);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("SMS sent successfully:", smsResult);

    // Increment SMS usage after successful send
    if (instanceId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.2");
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: incrementError } = await supabase
        .rpc('increment_sms_usage', { _instance_id: instanceId });

      if (incrementError) {
        console.error("Failed to increment SMS usage:", incrementError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "SMS sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
