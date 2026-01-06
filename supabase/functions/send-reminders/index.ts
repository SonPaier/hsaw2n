import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Reservation {
  id: string;
  customer_phone: string;
  customer_name: string;
  reservation_date: string;
  start_time: string;
  instance_id: string;
  service_id: string;
  confirmation_code: string;
  reminder_1day_sent: boolean | null;
  reminder_1hour_sent: boolean | null;
}

interface Service {
  name: string;
}

interface Instance {
  name: string;
  slug: string;
}

interface SmsMessageSetting {
  message_type: string;
  enabled: boolean;
  send_at_time: string | null;
}

// Check if SMS edit link should be included for this phone
const shouldIncludeEditLink = async (supabase: any, instanceId: string, phone: string): Promise<boolean> => {
  const { data: feature } = await supabase
    .from('instance_features')
    .select('enabled, parameters')
    .eq('instance_id', instanceId)
    .eq('feature_key', 'sms_edit_link')
    .maybeSingle();
  
  if (!feature || !feature.enabled) {
    return false;
  }
  
  // If no phones specified, send to everyone
  const params = feature.parameters as { phones?: string[] } | null;
  if (!params || !params.phones || params.phones.length === 0) {
    return true;
  }
  
  // Normalize phone for comparison
  let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (!normalizedPhone.startsWith("+")) {
    normalizedPhone = "+48" + normalizedPhone;
  }
  
  // Check if phone is in allowed list
  return params.phones.some(p => {
    let normalizedAllowed = p.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    if (!normalizedAllowed.startsWith("+")) {
      normalizedAllowed = "+48" + normalizedAllowed;
    }
    return normalizedPhone === normalizedAllowed;
  });
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const smsapiToken = Deno.env.get("SMSAPI_TOKEN");

    if (!smsapiToken) {
      console.log("SMSAPI_TOKEN not configured, skipping reminders");
      return new Response(
        JSON.stringify({ success: true, message: "SMS not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const now = new Date();
    const nowPlus1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    console.log("Checking for reminders at:", now.toISOString());
    console.log("1 hour window:", nowPlus1Hour.toISOString());
    console.log("Tomorrow date:", tomorrow.toISOString().split("T")[0]);

    // Get all SMS settings for instances
    const { data: smsSettings } = await supabase
      .from("sms_message_settings")
      .select("instance_id, message_type, enabled, send_at_time")
      .in("message_type", ["reminder_1day", "reminder_1hour"]);

    // Create a map of instance settings
    const instanceSettings = new Map<string, { reminder1day: SmsMessageSetting | null; reminder1hour: SmsMessageSetting | null }>();
    for (const setting of (smsSettings || [])) {
      const instanceId = setting.instance_id as string;
      if (!instanceSettings.has(instanceId)) {
        instanceSettings.set(instanceId, { reminder1day: null, reminder1hour: null });
      }
      const instanceSetting = instanceSettings.get(instanceId)!;
      if (setting.message_type === "reminder_1day") {
        instanceSetting.reminder1day = setting as SmsMessageSetting;
      } else if (setting.message_type === "reminder_1hour") {
        instanceSetting.reminder1hour = setting as SmsMessageSetting;
      }
    }

    // Get reservations that need 1-day reminder (for tomorrow)
    const tomorrowDate = tomorrow.toISOString().split("T")[0];
    const { data: dayReminders, error: dayError } = await supabase
      .from("reservations")
      .select("id, customer_phone, customer_name, reservation_date, start_time, instance_id, service_id, confirmation_code, reminder_1day_sent")
      .eq("status", "confirmed")
      .is("reminder_1day_sent", null)
      .eq("reservation_date", tomorrowDate);

    if (dayError) {
      console.error("Error fetching day reminders:", dayError);
    }

    // Get reservations that need 1-hour reminder
    const { data: hourReminders, error: hourError } = await supabase
      .from("reservations")
      .select("id, customer_phone, customer_name, reservation_date, start_time, instance_id, service_id, confirmation_code, reminder_1hour_sent")
      .eq("status", "confirmed")
      .is("reminder_1hour_sent", null)
      .eq("reservation_date", now.toISOString().split("T")[0]);

    if (hourError) {
      console.error("Error fetching hour reminders:", hourError);
    }

    // Cache instance info to avoid multiple queries
    const instanceCache: Record<string, { name: string; slug: string }> = {};
    
    const getInstanceInfo = async (instanceId: string): Promise<{ name: string; slug: string }> => {
      if (instanceCache[instanceId]) {
        return instanceCache[instanceId];
      }
      
      const { data: instanceData } = await supabase
        .from("instances")
        .select("name, slug")
        .eq("id", instanceId)
        .single() as { data: Instance | null };
      
      const info = { name: instanceData?.name || "Myjnia", slug: instanceData?.slug || "" };
      instanceCache[instanceId] = info;
      return info;
    };

    let sentCount = 0;
    const results: { type: string; reservationId: string; success: boolean }[] = [];

    // Process 1-day reminders
    for (const reservation of (dayReminders || []) as Reservation[]) {
      const instanceSetting = instanceSettings.get(reservation.instance_id);
      const reminder1daySetting = instanceSetting?.reminder1day;
      
      // Check if 1-day reminder is enabled for this instance
      if (reminder1daySetting && reminder1daySetting.enabled === false) {
        console.log(`1-day reminder disabled for instance ${reservation.instance_id}`);
        continue;
      }

      // Get the configured send time (default to 19:00 if not set)
      const sendAtTime = reminder1daySetting?.send_at_time || "19:00:00";
      const sendAtHour = parseInt(sendAtTime.split(":")[0], 10);
      const sendAtMinute = parseInt(sendAtTime.split(":")[1], 10);

      // Check if current time matches the configured send time (within 5-minute window)
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const sendTotalMinutes = sendAtHour * 60 + sendAtMinute;
      
      // Only send if we're within a 5-minute window of the configured time
      if (Math.abs(currentTotalMinutes - sendTotalMinutes) > 5) {
        continue;
      }

      // Get service name
      const { data: service } = await supabase
        .from("services")
        .select("name")
        .eq("id", reservation.service_id)
        .single() as { data: Service | null };

      // Get instance info dynamically
      const instanceInfo = await getInstanceInfo(reservation.instance_id);
      const reservationUrl = `https://${instanceInfo.slug}.n2wash.com/res?code=${reservation.confirmation_code}`;

      const serviceName = service?.name || "wizyta";
      const formattedTime = reservation.start_time.slice(0, 5);

      // Check if edit link should be included
      const includeEditLink = await shouldIncludeEditLink(supabase, reservation.instance_id, reservation.customer_phone);
      const editLinkPart = includeEditLink ? ` Zmień lub anuluj: ${reservationUrl}` : "";

      const message = `${instanceInfo.name}: Przypomnienie - jutro o ${formattedTime} masz wizytę.${editLinkPart}`;

      const success = await sendSms(reservation.customer_phone, message, smsapiToken, supabase, reservation.instance_id, reservation.id, 'reminder_1day');
      
      if (success) {
        await supabase
          .from("reservations")
          .update({ reminder_1day_sent: true })
          .eq("id", reservation.id);
        sentCount++;
      }

      results.push({ type: "1day", reservationId: reservation.id, success });
      console.log(`1-day reminder for ${reservation.id}: ${success ? "sent" : "failed"}`);
    }

    // Process 1-hour reminders
    for (const reservation of (hourReminders || []) as Reservation[]) {
      const instanceSetting = instanceSettings.get(reservation.instance_id);
      const reminder1hourSetting = instanceSetting?.reminder1hour;
      
      // Check if 1-hour reminder is enabled for this instance
      if (reminder1hourSetting && reminder1hourSetting.enabled === false) {
        console.log(`1-hour reminder disabled for instance ${reservation.instance_id}`);
        continue;
      }

      const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.start_time}`);
      const timeDiff = reservationDateTime.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      // Send if between 55 and 65 minutes before
      if (minutesDiff >= 55 && minutesDiff <= 65) {
        // Get instance info dynamically
        const instanceInfo = await getInstanceInfo(reservation.instance_id);
        
        const formattedTime = reservation.start_time.slice(0, 5);

        const message = `${instanceInfo.name}: Za godzinę o ${formattedTime} masz wizytę. Do zobaczenia!`;

        const success = await sendSms(reservation.customer_phone, message, smsapiToken, supabase, reservation.instance_id, reservation.id, 'reminder_1hour');
        
        if (success) {
          await supabase
            .from("reservations")
            .update({ reminder_1hour_sent: true })
            .eq("id", reservation.id);
          sentCount++;
        }

        results.push({ type: "1hour", reservationId: reservation.id, success });
        console.log(`1-hour reminder for ${reservation.id}: ${success ? "sent" : "failed"}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in send-reminders:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "send-reminders",
      request: req,
      tags: { function: "send-reminders" },
    });
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

async function sendSms(
  phone: string, 
  message: string, 
  token: string,
  supabase: any,
  instanceId: string,
  reservationId: string,
  messageType: 'reminder_1day' | 'reminder_1hour'
): Promise<boolean> {
  try {
    let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+48" + normalizedPhone;
    }

    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        to: normalizedPhone.replace("+", ""),
        message: message,
        format: "json",
      }),
    });

    const result = await response.json();
    
    if (result.error) {
      console.error("SMSAPI error:", result);
      
      // Log failed SMS
      await supabase.from('sms_logs').insert({
        instance_id: instanceId,
        phone: normalizedPhone,
        message: message,
        message_type: messageType,
        reservation_id: reservationId,
        status: 'failed',
        error_message: JSON.stringify(result.error),
        smsapi_response: result,
      });
      
      return false;
    }

    // Log successful SMS
    await supabase.from('sms_logs').insert({
      instance_id: instanceId,
      phone: normalizedPhone,
      message: message,
      message_type: messageType,
      reservation_id: reservationId,
      status: 'sent',
      smsapi_response: result,
    });

    return true;
  } catch (error) {
    console.error("SMS send error:", error);
    return false;
  }
}