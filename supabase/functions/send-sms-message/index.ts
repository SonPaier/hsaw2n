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
        from: "ARMCAR",
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
