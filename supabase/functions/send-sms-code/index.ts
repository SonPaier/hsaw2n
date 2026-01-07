import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { captureException } from "../_shared/sentry.ts";

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

    // Get instance short_name for SMS (prefer short_name, fallback to name)
    const { data: instanceData } = await supabase
      .from("instances")
      .select("name, short_name")
      .eq("id", instanceId)
      .single();

    const instanceName = instanceData?.short_name || instanceData?.name || "Myjnia";

    // Check SMS limit - but don't block, just log warning
    const { data: canSend, error: limitCheckError } = await supabase
      .rpc('check_sms_available', { _instance_id: instanceId });

    if (limitCheckError) {
      console.error("SMS limit check error:", limitCheckError);
      // Don't block sending, just log the error
    }

    // Log warning if limit exceeded, but don't block sending
    if (canSend === false) {
      console.warn(`SMS limit exceeded for instance ${instanceId} - sending anyway`);
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

    // Use dynamic instance name in SMS
    const smsMessage = `Kod potwierdzajacy ${instanceName}: ${code}`;
    
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
      }),
    });

    const smsResult = await smsResponse.json();
    console.log("SMSAPI response:", smsResult);

    if (smsResult.error) {
      console.error("SMSAPI error:", smsResult);
      
      // Log failed SMS
      await supabase.from('sms_logs').insert({
        instance_id: instanceId,
        phone: normalizedPhone,
        message: smsMessage,
        message_type: 'verification_code',
        status: 'failed',
        error_message: JSON.stringify(smsResult.error),
        smsapi_response: smsResult,
      });
      
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

    // Log successful SMS
    await supabase.from('sms_logs').insert({
      instance_id: instanceId,
      phone: normalizedPhone,
      message: smsMessage,
      message_type: 'verification_code',
      status: 'sent',
      smsapi_response: smsResult,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in send-sms-code:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "send-sms-code",
      request: req,
      tags: { function: "send-sms-code" },
    });
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
