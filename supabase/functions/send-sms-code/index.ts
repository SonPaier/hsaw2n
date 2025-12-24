import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSmsRequest {
  phone: string;
  instanceId: string;
  reservationData: {
    serviceId: string;
    addons: string[];
    date: string;
    time: string;
    customerName: string;
    customerPhone: string;
    carSize?: string;
    stationId?: string;
  };
}

const generateCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, instanceId, reservationData }: SendSmsRequest = await req.json();

    if (!phone || !instanceId || !reservationData) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+48" + normalizedPhone;
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store code in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from("sms_verification_codes")
      .insert({
        phone: normalizedPhone,
        code,
        instance_id: instanceId,
        reservation_data: reservationData,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to store verification code" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send SMS via SMSAPI
    const smsapiToken = Deno.env.get("SMSAPI_TOKEN");
    
    if (!smsapiToken) {
      console.error("SMSAPI_TOKEN not configured");
      // For development, just return success with code in response
      console.log(`DEV MODE: Code for ${normalizedPhone}: ${code}`);
      return new Response(
        JSON.stringify({ success: true, devCode: code }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Simple SMS format - SMSAPI blocks messages with links/domains
    // iOS autocomplete="one-time-code" still works with this format
    const smsMessage = `ARM CAR: ${code} - Twoj kod weryfikacyjny`;
    
    const smsResponse = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${smsapiToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        to: normalizedPhone.replace("+", ""),
        message: smsMessage,
        format: "json",
        // Note: "from" field removed - requires registered sender name in SMSAPI panel
        // To use custom sender name like "ARMCAR", register it at smsapi.pl/sendernames
      }),
    });

    const smsResult = await smsResponse.json();
    console.log("SMSAPI response:", smsResult);

    if (smsResult.error) {
      console.error("SMSAPI error:", smsResult);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: smsResult.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in send-sms-code:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
