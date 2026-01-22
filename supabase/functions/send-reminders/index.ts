import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { captureException } from "../_shared/sentry.ts";
import { normalizePhoneOrFallback } from "../_shared/phoneUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface Service {
  name: string;
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

/**
 * Get date/time components in a specific timezone using Intl.DateTimeFormat
 */
function getDateTimeInTimezone(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dateStr: string; // YYYY-MM-DD
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

/**
 * Get "tomorrow" date string in a specific timezone
 */
function getTomorrowInTimezone(date: Date, timezone: string): string {
  // Add 24 hours to the current date
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return getDateTimeInTimezone(tomorrow, timezone).dateStr;
}

/**
 * Calculate minutes until a reservation starts, accounting for timezone
 * The reservation_date + start_time are LOCAL times in the instance timezone
 */
function calculateMinutesUntilStart(
  nowUtc: Date,
  reservationDate: string, // YYYY-MM-DD
  startTime: string, // HH:MM:SS
  timezone: string
): number {
  // Get current time in instance timezone
  const nowLocal = getDateTimeInTimezone(nowUtc, timezone);
  const nowTotalMinutes = nowLocal.hours * 60 + nowLocal.minutes;
  
  // Parse reservation start time
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;
  
  // Get today in instance timezone
  const todayLocal = nowLocal.dateStr;
  
  // If reservation is today
  if (reservationDate === todayLocal) {
    return startTotalMinutes - nowTotalMinutes;
  }
  
  // If reservation is tomorrow, add 24*60 minutes
  const tomorrowLocal = getTomorrowInTimezone(nowUtc, timezone);
  if (reservationDate === tomorrowLocal) {
    return (24 * 60) + startTotalMinutes - nowTotalMinutes;
  }
  
  // Otherwise, reservation is not today or tomorrow - return large negative (skip)
  return -9999;
}

// ========================
// EXISTING HELPER FUNCTIONS
// ========================

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
  
  // Normalize phone for comparison using libphonenumber-js
  const normalizedPhone = normalizePhoneOrFallback(phone, "PL");
  
  // Check if phone is in allowed list
  return params.phones.some(p => {
    const normalizedAllowed = normalizePhoneOrFallback(p, "PL");
    return normalizedPhone === normalizedAllowed;
  });
};

// Atomic claim: attempt to "claim" a reservation for sending reminder
// Returns the reservation ID if claimed successfully, null otherwise
async function claimReservationFor1HourReminder(supabase: any, reservationId: string, backoffMinutes: number): Promise<boolean> {
  const backoffThreshold = new Date(Date.now() - backoffMinutes * 60 * 1000).toISOString();
  
  // Atomic update: only claim if not already sent AND last attempt was > backoffMinutes ago (or never)
  const { data, error } = await supabase
    .from("reservations")
    .update({ reminder_1hour_last_attempt_at: new Date().toISOString() })
    .eq("id", reservationId)
    .is("reminder_1hour_sent", null)
    .or(`reminder_1hour_last_attempt_at.is.null,reminder_1hour_last_attempt_at.lt.${backoffThreshold}`)
    .select("id")
    .maybeSingle();
  
  if (error) {
    console.error(`Error claiming 1-hour reminder for ${reservationId}:`, error);
    return false;
  }
  
  // If data is returned, we successfully claimed the reservation
  return !!data;
}

async function claimReservationFor1DayReminder(supabase: any, reservationId: string, backoffMinutes: number): Promise<boolean> {
  const backoffThreshold = new Date(Date.now() - backoffMinutes * 60 * 1000).toISOString();
  
  // Atomic update: only claim if not already sent AND last attempt was > backoffMinutes ago (or never)
  const { data, error } = await supabase
    .from("reservations")
    .update({ reminder_1day_last_attempt_at: new Date().toISOString() })
    .eq("id", reservationId)
    .is("reminder_1day_sent", null)
    .or(`reminder_1day_last_attempt_at.is.null,reminder_1day_last_attempt_at.lt.${backoffThreshold}`)
    .select("id")
    .maybeSingle();
  
  if (error) {
    console.error(`Error claiming 1-day reminder for ${reservationId}:`, error);
    return false;
  }
  
  // If data is returned, we successfully claimed the reservation
  return !!data;
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

    const now = new Date();
    console.log("=== SEND-REMINDERS START ===");
    console.log("UTC now:", now.toISOString());
    
    // Log Warsaw time for debugging
    const warsawTime = getDateTimeInTimezone(now, 'Europe/Warsaw');
    console.log(`Warsaw time: ${warsawTime.dateStr} ${String(warsawTime.hours).padStart(2,'0')}:${String(warsawTime.minutes).padStart(2,'0')}`);

    // Get all SMS settings for instances
    const { data: smsSettings, error: smsSettingsError } = await supabase
      .from("sms_message_settings")
      .select("instance_id, message_type, enabled, send_at_time")
      .in("message_type", ["reminder_1day", "reminder_1hour"]);

    if (smsSettingsError) {
      console.error("Error fetching SMS settings:", smsSettingsError);
    }
    console.log(`Fetched ${(smsSettings || []).length} SMS settings`);

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
        console.log(`Instance ${instanceId}: reminder_1day enabled=${setting.enabled}, send_at_time=${setting.send_at_time}`);
      } else if (setting.message_type === "reminder_1hour") {
        instanceSetting.reminder1hour = setting as SmsMessageSetting;
      }
    }

    // Cache instance info to avoid multiple queries (includes timezone!)
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

    // Get candidate reservations for both types
    // We'll filter them per-instance with proper timezone logic
    
    // Get ALL confirmed reservations not yet sent (for next 2 days)
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const todayUtc = now.toISOString().split("T")[0];
    const maxDate = twoDaysFromNow.toISOString().split("T")[0];
    
    // Fetch candidates for 1-day reminders (tomorrow in any timezone)
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

    // Fetch candidates for 1-hour reminders (today in any timezone)
    const { data: candidateHourReminders, error: fetchHourError } = await supabase
      .from("reservations")
      .select("id, customer_phone, customer_name, reservation_date, start_time, instance_id, service_id, confirmation_code, reminder_1hour_last_attempt_at, reminder_failure_count, reminder_permanent_failure, reminder_failure_reason")
      .eq("status", "confirmed")
      .is("reminder_1hour_sent", null)
      .gte("reservation_date", todayUtc)
      .lte("reservation_date", maxDate)
      .or("reminder_permanent_failure.is.null,reminder_permanent_failure.eq.false");

    if (fetchHourError) {
      console.error("Error fetching hour reminders:", fetchHourError);
    }

    let sentCount = 0;
    let skippedClaimed = 0;
    let skippedTimezone = 0;
    const results: { type: string; reservationId: string; success: boolean; skipped?: string }[] = [];

    // ========================
    // PROCESS 1-DAY REMINDERS
    // ========================
    console.log(`Processing ${(candidateDayReminders || []).length} candidate 1-day reminders`);
    
    for (const reservation of (candidateDayReminders || []) as Reservation[]) {
      const instanceSetting = instanceSettings.get(reservation.instance_id);
      const reminder1daySetting = instanceSetting?.reminder1day;
      
      console.log(`[1-day] Checking reservation ${reservation.id} (code=${reservation.confirmation_code}), instance=${reservation.instance_id}`);
      console.log(`[1-day] Instance setting found: ${!!instanceSetting}, reminder1day: ${JSON.stringify(reminder1daySetting)}`);
      
      // Skip if 1-day reminder is disabled for this instance
      if (reminder1daySetting && reminder1daySetting.enabled === false) {
        console.log(`[1-day] SKIP: disabled for instance ${reservation.instance_id}`);
        continue;
      }

      // Get instance info (with timezone)
      const instanceInfo = await getInstanceInfo(reservation.instance_id);
      const timezone = instanceInfo.timezone || 'Europe/Warsaw';
      
      // Get current time in instance timezone
      const nowLocal = getDateTimeInTimezone(now, timezone);
      const tomorrowLocal = getTomorrowInTimezone(now, timezone);
      
      console.log(`[1-day] res=${reservation.id}: tz=${timezone}, nowLocal=${nowLocal.dateStr} ${nowLocal.hours}:${nowLocal.minutes}, tomorrowLocal=${tomorrowLocal}, res_date=${reservation.reservation_date}`);
      
      // Check if reservation is for tomorrow in this timezone
      if (reservation.reservation_date !== tomorrowLocal) {
        console.log(`[1-day] SKIP: res_date=${reservation.reservation_date} != tomorrow=${tomorrowLocal}`);
        continue;
      }

      // Get the configured send time (default to 19:00 if not set)
      const sendAtTime = reminder1daySetting?.send_at_time || "19:00:00";
      const [sendHour, sendMinute] = sendAtTime.split(":").map(Number);
      
      const currentTotalMinutes = nowLocal.hours * 60 + nowLocal.minutes;
      const sendTotalMinutes = sendHour * 60 + sendMinute;
      const timeDiff = Math.abs(currentTotalMinutes - sendTotalMinutes);
      
      console.log(`[1-day] res=${reservation.id}: currentMinutes=${currentTotalMinutes}, sendMinutes=${sendTotalMinutes}, diff=${timeDiff}`);
      
      // Only send if we're within a 5-minute window of the configured time
      if (timeDiff > 5) {
        console.log(`[1-day] SKIP: time diff ${timeDiff} > 5 minutes`);
        skippedTimezone++;
        continue;
      }

      console.log(`[1-day] MATCH! Attempting to send for ${reservation.id} (${reservation.confirmation_code})`);

      // ATOMIC CLAIM: Try to claim this reservation for sending
      const claimed = await claimReservationFor1DayReminder(supabase, reservation.id, BACKOFF_MINUTES);
      if (!claimed) {
        console.log(`1-day reminder for ${reservation.id}: skipped (already claimed or in backoff)`);
        skippedClaimed++;
        results.push({ type: "1day", reservationId: reservation.id, success: false, skipped: "claimed_or_backoff" });
        continue;
      }

      // Get service name
      const { data: service } = await supabase
        .from("services")
        .select("name")
        .eq("id", reservation.service_id)
        .single() as { data: Service | null };

      const reservationUrl = `https://${instanceInfo.slug}.n2wash.com/res?code=${reservation.confirmation_code}`;
      const formattedTime = reservation.start_time.slice(0, 5);

      // Check if edit link should be included
      const includeEditLink = await shouldIncludeEditLink(supabase, reservation.instance_id, reservation.customer_phone);
      const editLinkPart = includeEditLink ? ` Zmień lub anuluj: ${reservationUrl}` : "";

      const message = `${instanceInfo.name}: Przypomnienie - jutro o ${formattedTime} masz wizytę.${editLinkPart}`;

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
        
        if (isPermanentFailure) {
          console.log(`1-day reminder for ${reservation.id}: marked as PERMANENT FAILURE after ${newFailureCount} attempts`);
        }
      }

      results.push({ type: "1day", reservationId: reservation.id, success });
      console.log(`1-day reminder for ${reservation.id}: ${success ? "sent" : "failed (will retry after backoff)"}`);
    }

    // ========================
    // PROCESS 1-HOUR REMINDERS
    // ========================
    console.log(`Processing ${(candidateHourReminders || []).length} candidate 1-hour reminders`);
    
    for (const reservation of (candidateHourReminders || []) as Reservation[]) {
      const instanceSetting = instanceSettings.get(reservation.instance_id);
      const reminder1hourSetting = instanceSetting?.reminder1hour;
      
      // Skip if 1-hour reminder is disabled for this instance
      if (reminder1hourSetting && reminder1hourSetting.enabled === false) {
        console.log(`1-hour disabled for instance ${reservation.instance_id}, skip ${reservation.id}`);
        continue;
      }

      // Get instance info (with timezone)
      const instanceInfo = await getInstanceInfo(reservation.instance_id);
      const timezone = instanceInfo.timezone || 'Europe/Warsaw';
      
      // Calculate minutes until start in instance timezone
      const minutesUntilStart = calculateMinutesUntilStart(
        now,
        reservation.reservation_date,
        reservation.start_time,
        timezone
      );

      // Send if between 55 and 65 minutes before
      if (minutesUntilStart < 55 || minutesUntilStart > 65) {
        continue;
      }

      console.log(`1-hour candidate: ${reservation.id}, tz=${timezone}, minutesUntil=${minutesUntilStart}, res_date=${reservation.reservation_date}, start=${reservation.start_time}`);

      // ATOMIC CLAIM: Try to claim this reservation for sending
      const claimed = await claimReservationFor1HourReminder(supabase, reservation.id, BACKOFF_MINUTES);
      if (!claimed) {
        console.log(`1-hour reminder for ${reservation.id}: skipped (already claimed or in backoff)`);
        skippedClaimed++;
        results.push({ type: "1hour", reservationId: reservation.id, success: false, skipped: "claimed_or_backoff" });
        continue;
      }

      const formattedTime = reservation.start_time.slice(0, 5);
      const phonePart = instanceInfo.reservation_phone ? ` Telefon: ${instanceInfo.reservation_phone}.` : "";

      const message = `${instanceInfo.name}: Za godzine o ${formattedTime} masz wizyte.${phonePart} Do zobaczenia!`;

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
        
        if (isPermanentFailure) {
          console.log(`1-hour reminder for ${reservation.id}: marked as PERMANENT FAILURE after ${newFailureCount} attempts`);
        }
      }

      results.push({ type: "1hour", reservationId: reservation.id, success });
      console.log(`1-hour reminder for ${reservation.id}: ${success ? "sent" : "failed (will retry after backoff)"}`);
    }

    console.log(`=== SEND-REMINDERS COMPLETE ===`);
    console.log(`Summary: sent=${sentCount}, skippedClaimed=${skippedClaimed}, skippedTimezone=${skippedTimezone}`);

    return new Response(
      JSON.stringify({ success: true, sentCount, skippedClaimed, skippedTimezone, results }),
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
    // Normalize phone using libphonenumber-js
    const normalizedPhone = normalizePhoneOrFallback(phone, "PL");
    console.log(`Normalized phone: ${phone} -> ${normalizedPhone}`);

    // Validate phone length (should be 11-15 digits for E.164)
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
      
      // Determine error reason from SMSAPI response
      const errorCode = result.error?.toString() || 'api_error';
      
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
      
      return { success: false, errorReason: errorCode };
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

    return { success: true };
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, errorReason: 'network_error' };
  }
}
