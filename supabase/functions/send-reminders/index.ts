import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { captureException } from "../_shared/sentry.ts";
import { normalizePhoneOrFallback } from "../_shared/phoneUtils.ts";
import { 
  buildReminderTodaySms, 
  isInHourlyWindow, 
  HOURLY_WINDOWS 
} from "../_shared/reminderUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// v01.27.09 - Window-based reminders with early exit

// Backoff time in minutes - prevents retry spam
const BACKOFF_MINUTES = 15;

// Max failures before marking as permanent
const MAX_FAILURE_COUNT = 3;

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
  reminder_1day_last_attempt_at: string | null;
  reminder_1hour_last_attempt_at: string | null;
  reminder_failure_count: number;
  reminder_permanent_failure: boolean;
  reminder_failure_reason: string | null;
}

interface InstanceData {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  phone: string | null;
  reservation_phone: string | null;
  timezone: string | null;
}

interface SmsMessageSetting {
  message_type: string;
  enabled: boolean;
  send_at_time: string | null;
}

// ========================
// TIMEZONE HELPER FUNCTIONS
// ========================

function getDateTimeInTimezone(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dateStr: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  return { year, month, day, hours, minutes, dateStr };
}

function getTomorrowInTimezone(date: Date, timezone: string): string {
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return getDateTimeInTimezone(tomorrow, timezone).dateStr;
}

// ========================
// HELPER FUNCTIONS
// ========================

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
  
  const params = feature.parameters as { phones?: string[] } | null;
  if (!params || !params.phones || params.phones.length === 0) {
    return true;
  }
  
  const normalizedPhone = normalizePhoneOrFallback(phone, "PL");
  
  return params.phones.some(p => {
    const normalizedAllowed = normalizePhoneOrFallback(p, "PL");
    return normalizedPhone === normalizedAllowed;
  });
};

async function claimReservationFor1HourReminder(supabase: any, reservationId: string, backoffMinutes: number): Promise<boolean> {
  const backoffThreshold = new Date(Date.now() - backoffMinutes * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  
  const { data, error } = await supabase.rpc('claim_reminder_1hour', {
    p_reservation_id: reservationId,
    p_now: nowIso,
    p_backoff_threshold: backoffThreshold
  });
  
  if (error) {
    console.log(`RPC claim_reminder_1hour failed, trying direct update: ${error.message}`);
    const { data: directData, error: directError } = await supabase
      .from("reservations")
      .update({ reminder_1hour_last_attempt_at: nowIso })
      .eq("id", reservationId)
      .is("reminder_1hour_sent", null)
      .or(`reminder_1hour_last_attempt_at.is.null,reminder_1hour_last_attempt_at.lt.${backoffThreshold}`)
      .select("id")
      .maybeSingle();
    
    if (directError) {
      console.error(`Error claiming 1-hour reminder for ${reservationId}:`, directError);
      return false;
    }
    return !!directData;
  }
  
  return data === true;
}

async function claimReservationFor1DayReminder(supabase: any, reservationId: string, backoffMinutes: number): Promise<boolean> {
  const backoffThreshold = new Date(Date.now() - backoffMinutes * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  
  const { data, error } = await supabase.rpc('claim_reminder_1day', {
    p_reservation_id: reservationId,
    p_now: nowIso,
    p_backoff_threshold: backoffThreshold
  });
  
  if (error) {
    console.log(`RPC claim_reminder_1day failed, trying direct update: ${error.message}`);
    const { data: directData, error: directError } = await supabase
      .from("reservations")
      .update({ reminder_1day_last_attempt_at: nowIso })
      .eq("id", reservationId)
      .is("reminder_1day_sent", null)
      .or(`reminder_1day_last_attempt_at.is.null,reminder_1day_last_attempt_at.lt.${backoffThreshold}`)
      .select("id")
      .maybeSingle();
    
    if (directError) {
      console.error(`Error claiming 1-day reminder for ${reservationId}:`, directError);
      return false;
    }
    return !!directData;
  }
  
  return data === true;
}

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

    // Parse request body for type and window parameters
    let reminderType: '1day' | '1hour' | undefined;
    let windowNumber: number | undefined;
    
    try {
      const body = await req.json();
      reminderType = body?.type as '1day' | '1hour' | undefined;
      windowNumber = body?.window as number | undefined;
    } catch {
      // No body or invalid JSON - process all types (backwards compatibility)
    }

    const now = new Date();
    console.log("=== SEND-REMINDERS START ===");
    console.log("UTC now:", now.toISOString());
    console.log(`Parameters: type=${reminderType || 'all'}, window=${windowNumber || 'none'}`);
    
    const warsawTime = getDateTimeInTimezone(now, 'Europe/Warsaw');
    console.log(`Warsaw time: ${warsawTime.dateStr} ${String(warsawTime.hours).padStart(2,'0')}:${String(warsawTime.minutes).padStart(2,'0')}`);

    // EARLY EXIT: Quick check if there are any candidates at all
    const todayUtc = now.toISOString().split("T")[0];
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const maxDate = twoDaysFromNow.toISOString().split("T")[0];
    
    const { count: candidateCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('reservation_date', todayUtc)
      .lte('reservation_date', maxDate)
      .or('reminder_1day_sent.is.null,reminder_1hour_sent.is.null')
      .or('reminder_permanent_failure.is.null,reminder_permanent_failure.eq.false');

    if (candidateCount === 0) {
      console.log("=== EARLY EXIT: No candidates ===");
      return new Response(
        JSON.stringify({ success: true, message: "No candidates, early exit", sentCount: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    console.log(`Found ${candidateCount} potential candidates`);

    // Get all SMS settings for instances
    const { data: smsSettings, error: smsSettingsError } = await supabase
      .from("sms_message_settings")
      .select("instance_id, message_type, enabled, send_at_time")
      .in("message_type", ["reminder_1day", "reminder_1hour"]);

    if (smsSettingsError) {
      console.error("Error fetching SMS settings:", smsSettingsError);
    }

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

    const instanceCache: Record<string, InstanceData> = {};
    
    const getInstanceInfo = async (instanceId: string): Promise<InstanceData> => {
      if (instanceCache[instanceId]) {
        return instanceCache[instanceId];
      }
      
      const { data: instanceData } = await supabase
        .from("instances")
        .select("id, name, short_name, slug, phone, reservation_phone, timezone")
        .eq("id", instanceId)
        .single();
      
      const info: InstanceData = { 
        id: instanceId,
        name: instanceData?.short_name || instanceData?.name || "Myjnia", 
        short_name: instanceData?.short_name || null,
        slug: instanceData?.slug || "",
        phone: instanceData?.phone || null,
        reservation_phone: instanceData?.reservation_phone || instanceData?.phone || null,
        timezone: instanceData?.timezone || 'Europe/Warsaw'
      };
      instanceCache[instanceId] = info;
      return info;
    };

    let sentCount = 0;
    let skippedClaimed = 0;
    let skippedTimezone = 0;
    let skippedWindow = 0;
    const results: { type: string; reservationId: string; success: boolean; skipped?: string }[] = [];

    // ========================
    // PROCESS 1-DAY REMINDERS
    // ========================
    if (!reminderType || reminderType === '1day') {
      const { data: candidateDayReminders, error: fetchDayError } = await supabase
        .from("reservations")
        .select("id, customer_phone, customer_name, reservation_date, start_time, instance_id, service_id, confirmation_code, reminder_1day_last_attempt_at, reminder_failure_count, reminder_permanent_failure, reminder_failure_reason")
        .eq("status", "confirmed")
        .is("reminder_1day_sent", null)
        .gte("reservation_date", todayUtc)
        .lte("reservation_date", maxDate)
        .or("reminder_permanent_failure.is.null,reminder_permanent_failure.eq.false");

      if (fetchDayError) {
        console.error("Error fetching day reminders:", fetchDayError);
      }

      console.log(`Processing ${(candidateDayReminders || []).length} candidate 1-day reminders`);
      
      for (const reservation of (candidateDayReminders || []) as Reservation[]) {
        const instanceSetting = instanceSettings.get(reservation.instance_id);
        const reminder1daySetting = instanceSetting?.reminder1day;
        
        if (reminder1daySetting && reminder1daySetting.enabled === false) {
          continue;
        }

        const instanceInfo = await getInstanceInfo(reservation.instance_id);
        const timezone = instanceInfo.timezone || 'Europe/Warsaw';
        
        const nowLocal = getDateTimeInTimezone(now, timezone);
        const tomorrowLocal = getTomorrowInTimezone(now, timezone);
        
        if (reservation.reservation_date !== tomorrowLocal) {
          continue;
        }

        const sendAtTime = reminder1daySetting?.send_at_time || "19:00:00";
        const [sendHour, sendMinute] = sendAtTime.split(":").map(Number);
        
        const currentTotalMinutes = nowLocal.hours * 60 + nowLocal.minutes;
        const sendTotalMinutes = sendHour * 60 + sendMinute;
        const timeDiff = Math.abs(currentTotalMinutes - sendTotalMinutes);
        
        if (timeDiff > 5) {
          skippedTimezone++;
          continue;
        }

        console.log(`[1-day] MATCH! res=${reservation.id} (${reservation.confirmation_code})`);

        const claimed = await claimReservationFor1DayReminder(supabase, reservation.id, BACKOFF_MINUTES);
        if (!claimed) {
          skippedClaimed++;
          results.push({ type: "1day", reservationId: reservation.id, success: false, skipped: "claimed_or_backoff" });
          continue;
        }

        const reservationUrl = `https://${instanceInfo.slug}.n2wash.com/res?code=${reservation.confirmation_code}`;
        const formattedTime = reservation.start_time.slice(0, 5);

        const includeEditLink = await shouldIncludeEditLink(supabase, reservation.instance_id, reservation.customer_phone);
        const editLinkPart = includeEditLink ? ` Zmien lub anuluj: ${reservationUrl}` : "";

        const message = `${instanceInfo.name}: Przypomnienie - jutro o ${formattedTime} masz wizyte.${editLinkPart}`;

        const { success, errorReason } = await sendSms(reservation.customer_phone, message, smsapiToken, supabase, reservation.instance_id, reservation.id, 'reminder_1day');
        
        if (success) {
          await supabase
            .from("reservations")
            .update({ 
              reminder_1day_sent: true,
              reminder_failure_count: 0,
              reminder_failure_reason: null
            })
            .eq("id", reservation.id);
          sentCount++;
        } else {
          const newFailureCount = (reservation.reminder_failure_count || 0) + 1;
          const isPermanentFailure = newFailureCount >= MAX_FAILURE_COUNT;
          
          await supabase
            .from("reservations")
            .update({ 
              reminder_failure_count: newFailureCount,
              reminder_permanent_failure: isPermanentFailure,
              reminder_failure_reason: errorReason || 'unknown_error'
            })
            .eq("id", reservation.id);
        }

        results.push({ type: "1day", reservationId: reservation.id, success });
      }
    }

    // ========================
    // PROCESS "TODAY" REMINDERS (window-based, replaces 1-hour)
    // ========================
    if (!reminderType || reminderType === '1hour') {
      const { data: candidateHourReminders, error: fetchHourError } = await supabase
        .from("reservations")
        .select("id, customer_phone, customer_name, reservation_date, start_time, instance_id, service_id, confirmation_code, reminder_1hour_last_attempt_at, reminder_failure_count, reminder_permanent_failure, reminder_failure_reason")
        .eq("status", "confirmed")
        .is("reminder_1hour_sent", null)
        .gte("reservation_date", todayUtc)
        .lte("reservation_date", maxDate)
        .or("reminder_permanent_failure.is.null,reminder_permanent_failure.eq.false");

      if (fetchHourError) {
        console.error("Error fetching today reminders:", fetchHourError);
      }

      console.log(`Processing ${(candidateHourReminders || []).length} candidate today reminders (window=${windowNumber || 'all'})`);
      
      for (const reservation of (candidateHourReminders || []) as Reservation[]) {
        const instanceSetting = instanceSettings.get(reservation.instance_id);
        const reminder1hourSetting = instanceSetting?.reminder1hour;
        
        if (reminder1hourSetting && reminder1hourSetting.enabled === false) {
          continue;
        }

        const instanceInfo = await getInstanceInfo(reservation.instance_id);
        const timezone = instanceInfo.timezone || 'Europe/Warsaw';
        
        const nowLocal = getDateTimeInTimezone(now, timezone);
        
        // Must be today
        if (reservation.reservation_date !== nowLocal.dateStr) {
          continue;
        }

        // If window specified, check if reservation is in that window
        if (windowNumber !== undefined) {
          if (!isInHourlyWindow(reservation.start_time, windowNumber)) {
            skippedWindow++;
            continue;
          }
        } else {
          // Legacy mode (no window specified): use 55-65 minute logic
          const [startHour, startMinute] = reservation.start_time.split(':').map(Number);
          const startTotalMinutes = startHour * 60 + startMinute;
          const nowTotalMinutes = nowLocal.hours * 60 + nowLocal.minutes;
          const minutesUntilStart = startTotalMinutes - nowTotalMinutes;
          
          if (minutesUntilStart < 55 || minutesUntilStart > 65) {
            continue;
          }
        }

        console.log(`[today] MATCH! res=${reservation.id}, start=${reservation.start_time}, window=${windowNumber || 'legacy'}`);

        const claimed = await claimReservationFor1HourReminder(supabase, reservation.id, BACKOFF_MINUTES);
        if (!claimed) {
          skippedClaimed++;
          results.push({ type: "1hour", reservationId: reservation.id, success: false, skipped: "claimed_or_backoff" });
          continue;
        }

        const formattedTime = reservation.start_time.slice(0, 5);

        // Use new "Today" SMS template
        const message = buildReminderTodaySms({
          instanceName: instanceInfo.name,
          time: formattedTime,
          phone: instanceInfo.reservation_phone,
        });

        const { success, errorReason } = await sendSms(reservation.customer_phone, message, smsapiToken, supabase, reservation.instance_id, reservation.id, 'reminder_1hour');
        
        if (success) {
          await supabase
            .from("reservations")
            .update({ 
              reminder_1hour_sent: true,
              reminder_failure_count: 0,
              reminder_failure_reason: null
            })
            .eq("id", reservation.id);
          sentCount++;
        } else {
          const newFailureCount = (reservation.reminder_failure_count || 0) + 1;
          const isPermanentFailure = newFailureCount >= MAX_FAILURE_COUNT;
          
          await supabase
            .from("reservations")
            .update({ 
              reminder_failure_count: newFailureCount,
              reminder_permanent_failure: isPermanentFailure,
              reminder_failure_reason: errorReason || 'unknown_error'
            })
            .eq("id", reservation.id);
        }

        results.push({ type: "1hour", reservationId: reservation.id, success });
      }
    }

    console.log(`=== SEND-REMINDERS COMPLETE ===`);
    console.log(`Summary: sent=${sentCount}, skippedClaimed=${skippedClaimed}, skippedTimezone=${skippedTimezone}, skippedWindow=${skippedWindow}`);

    return new Response(
      JSON.stringify({ success: true, sentCount, skippedClaimed, skippedTimezone, skippedWindow, results }),
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

interface SmsResult {
  success: boolean;
  errorReason?: string;
}

async function sendSms(
  phone: string, 
  message: string, 
  token: string,
  supabase: any,
  instanceId: string,
  reservationId: string,
  messageType: 'reminder_1day' | 'reminder_1hour'
): Promise<SmsResult> {
  try {
    const normalizedPhone = normalizePhoneOrFallback(phone, "PL");
    console.log(`Normalized phone: ${phone} -> ${normalizedPhone}`);

    const digitsOnly = normalizedPhone.replace(/\D/g, "");
    if (digitsOnly.length < 9 || digitsOnly.length > 15) {
      console.error(`Invalid phone number length: ${normalizedPhone} (${digitsOnly.length} digits)`);
      
      await supabase.from('sms_logs').insert({
        instance_id: instanceId,
        phone: normalizedPhone,
        message: message,
        message_type: messageType,
        reservation_id: reservationId,
        status: 'failed',
        error_message: `Invalid phone number length: ${digitsOnly.length} digits`,
      });
      
      return { success: false, errorReason: 'invalid_phone_length' };
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
      
      const errorCode = result.error?.toString() || 'api_error';
      
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
      
      return { success: false, errorReason: errorCode };
    }

    await supabase.from('sms_logs').insert({
      instance_id: instanceId,
      phone: normalizedPhone,
      message: message,
      message_type: messageType,
      reservation_id: reservationId,
      status: 'sent',
      smsapi_response: result,
    });

    return { success: true };
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, errorReason: 'network_error' };
  }
}
