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

    // Check SMS limit before proceeding
    const { data: canSend, error: limitCheckError } = await supabase
      .rpc('check_sms_available', { _instance_id: instanceId });

    if (limitCheckError) {
      console.error("SMS limit check error:", limitCheckError);
      return new Response(
        JSON.stringify({ error: "Failed to check SMS limit" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!canSend) {
      console.log(`SMS limit exceeded for instance ${instanceId}`);
      return new Response(
        JSON.stringify({ error: "SMS limit exceeded", code: "SMS_LIMIT_EXCEEDED" }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    // Simple SMS format until SMSAPI link restriction is removed
    // TODO: After SMSAPI unblocks links, use WebOTP format:
    // const smsMessage = `Kod: ${code}\n@${domain} #${code}`;
    const smsMessage = `ARM CAR kod: ${code}`;
    
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

    // Increment SMS usage after successful send
    const { data: incremented, error: incrementError } = await supabase
      .rpc('increment_sms_usage', { _instance_id: instanceId });

    if (incrementError) {
      console.error("Failed to increment SMS usage:", incrementError);
      // Don't fail the request, SMS was already sent
    } else {
      console.log(`SMS usage incremented for instance ${instanceId}: ${incremented}`);
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
