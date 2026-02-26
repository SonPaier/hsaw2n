import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { captureException } from "../_shared/sentry.ts";
import { normalizePhoneOrFallback } from "../_shared/phoneUtils.ts";

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
        // Don't block sending, just log the error
      }

      // Log warning if limit exceeded, but don't block
      if (canSend === false) {
        console.warn(`SMS limit exceeded for instance ${instanceId} - sending anyway`);
      }
    }

    // Normalize phone number using libphonenumber-js
    const normalizedPhone = normalizePhoneOrFallback(phone, "PL");
    console.log(`Normalized phone: ${phone} -> ${normalizedPhone}`);
    
    // Validate phone number format (should be 11-15 digits including country code)
    const digitsOnly = normalizedPhone.replace(/\D/g, "");
    
    if (digitsOnly.length < 11 || digitsOnly.length > 15) {
      console.error(`Invalid phone number length: ${normalizedPhone} (${digitsOnly.length} digits)`);
      return new Response(
        JSON.stringify({ error: "Invalid phone number format", phone: normalizedPhone, digits: digitsOnly.length }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Demo instance - never send real SMS
    const DEMO_INSTANCE_IDS = ['b3c29bfe-f393-4e1a-a837-68dd721df420'];
    if (instanceId && DEMO_INSTANCE_IDS.includes(instanceId)) {
      console.log(`[DEMO] Simulating SMS to ${normalizedPhone}: ${message}`);
      const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient: cc } = await import("https://esm.sh/@supabase/supabase-js@2.49.2");
      const sb = cc(supabaseUrl2, supabaseKey2);
      await sb.from('sms_logs').insert({
        instance_id: instanceId,
        phone: normalizedPhone,
        message: message,
        message_type: 'manual',
        status: 'simulated',
        error_message: 'Demo instance - SMS not sent',
      });
      return new Response(
        JSON.stringify({ success: true, message: "SMS simulated (demo instance)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      
      // Log failed SMS
      if (instanceId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.2");
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase.from('sms_logs').insert({
          instance_id: instanceId,
          phone: normalizedPhone,
          message: message,
          message_type: 'manual',
          status: 'failed',
          error_message: JSON.stringify(smsResult.error),
          smsapi_response: smsResult,
        });
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("SMS sent successfully:", smsResult);

    // Increment SMS usage and log successful send
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
      
      // Log successful SMS
      await supabase.from('sms_logs').insert({
        instance_id: instanceId,
        phone: normalizedPhone,
        message: message,
        message_type: 'manual',
        status: 'sent',
        smsapi_response: smsResult,
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "SMS sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "send-sms-message",
      request: req,
      tags: { function: "send-sms-message" },
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
