import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifySmsRequest {
  phone: string;
  code: string;
  instanceId: string;
}

// Generate unique 7-digit confirmation code
const generateUniqueConfirmationCode = async (supabase: any): Promise<string> => {
  const digits = '0123456789';
  
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    
    // Check uniqueness among ALL reservations
    const { data } = await supabase
      .from('reservations')
      .select('id')
      .eq('confirmation_code', code)
      .maybeSingle();
    
    if (!data) return code;
  }
  throw new Error('Failed to generate unique confirmation code');
};

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
    const { phone, code, instanceId }: VerifySmsRequest = await req.json();

    if (!phone || !code || !instanceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+48" + normalizedPhone;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find verification code
    const { data: verificationData, error: verifyError } = await supabase
      .from("sms_verification_codes")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("instance_id", instanceId)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verifyError) {
      console.error("Database error:", verifyError);
      return new Response(
        JSON.stringify({ error: "Verification failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!verificationData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark as verified
    await supabase
      .from("sms_verification_codes")
      .update({ verified: true })
      .eq("id", verificationData.id);

    const reservationData = verificationData.reservation_data as {
      serviceId: string;
      addons: string[];
      date: string;
      time: string;
      customerName: string;
      customerPhone: string;
      carSize?: string;
      stationId?: string;
      vehiclePlate?: string;
      notes?: string;
    };

    // Calculate end time based on service duration
    const { data: serviceData } = await supabase
      .from("services")
      .select("duration_minutes, name")
      .eq("id", reservationData.serviceId)
      .single();

    const durationMinutes = serviceData?.duration_minutes || 60;
    const [hours, minutes] = reservationData.time.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    const confirmationCode = await generateUniqueConfirmationCode(supabase);

    // Check instance auto_confirm setting and get google maps URL and name (prefer short_name)
    const { data: instanceSettings } = await supabase
      .from("instances")
      .select("auto_confirm_reservations, google_maps_url, name, short_name, social_facebook, social_instagram, slug")
      .eq("id", instanceId)
      .single();

    const autoConfirm = instanceSettings?.auto_confirm_reservations !== false;
    const googleMapsUrl = instanceSettings?.google_maps_url || null;
    const instanceName = instanceSettings?.short_name || instanceSettings?.name || "Myjnia";
    const reservationStatus = autoConfirm ? "confirmed" : "pending";

    // Create reservation
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        instance_id: instanceId,
        service_id: reservationData.serviceId,
        station_id: reservationData.stationId || null,
        reservation_date: reservationData.date,
        start_time: reservationData.time,
        end_time: endTime,
        customer_name: reservationData.customerName,
        customer_phone: normalizedPhone,
        vehicle_plate: reservationData.vehiclePlate || "BRAK",
        notes: reservationData.notes || null,
        confirmation_code: confirmationCode,
        car_size: reservationData.carSize || null,
        status: reservationStatus,
        source: "customer",
      })
      .select()
      .single();

    // Format date for notifications
    const notifDateObj = new Date(reservationData.date);
    const notifDayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const notifMonthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
    const notifDayName = notifDayNames[notifDateObj.getDay()];
    const notifDayNum = notifDateObj.getDate();
    const notifMonthName = notifMonthNames[notifDateObj.getMonth()];

    // Create notification for new reservation
    try {
      await supabase
        .from("notifications")
        .insert({
          instance_id: instanceId,
          type: "reservation_new",
          title: `Nowa rezerwacja: ${reservationData.customerName}`,
          description: `${serviceData?.name || 'Usługa'} - ${notifDayName} ${notifDayNum} ${notifMonthName} o ${reservationData.time}`,
          entity_type: "reservation",
          entity_id: reservation?.id,
        });
      console.log("Notification created for new reservation");
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    // Send push notification to admin
    try {
      const pushUrl = Deno.env.get("SUPABASE_URL");
      const pushKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (pushUrl && pushKey) {
        const pushResponse = await fetch(`${pushUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${pushKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instanceId: instanceId,
            title: `📅 Nowa rezerwacja: ${reservationData.customerName}`,
            body: `${serviceData?.name || 'Usługa'} - ${notifDayName} ${notifDayNum} ${notifMonthName} o ${reservationData.time}`,
            url: `/admin?reservationCode=${confirmationCode}`,
            tag: `new-reservation-${reservation?.id}`,
          }),
        });
        console.log("Push notification sent:", pushResponse.status);
      }
    } catch (pushError) {
      console.error("Failed to send push notification:", pushError);
    }

    if (reservationError) {
      console.error("Reservation error:", reservationError);
      return new Response(
        JSON.stringify({ error: "Failed to create reservation" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create or update customer with phone_verified = true
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .eq("instance_id", instanceId)
      .maybeSingle();

    let customerId: string | null = null;

    if (existingCustomer) {
      // Update existing customer - mark as verified
      await supabase
        .from("customers")
        .update({ 
          phone_verified: true,
          name: reservationData.customerName,
        })
        .eq("id", existingCustomer.id);
      customerId = existingCustomer.id;
    } else {
      // Create new customer with verified phone
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          instance_id: instanceId,
          phone: normalizedPhone,
          name: reservationData.customerName,
          phone_verified: true,
        })
        .select("id")
        .single();
      
      customerId = newCustomer?.id || null;
    }

    // Upsert customer vehicle
    if (customerId && reservationData.vehiclePlate && reservationData.vehiclePlate !== "BRAK") {
      try {
        await supabase.rpc("upsert_customer_vehicle", {
          _instance_id: instanceId,
          _phone: normalizedPhone,
          _model: reservationData.vehiclePlate,
          _plate: null,
          _customer_id: customerId,
        });
        console.log("Customer vehicle upserted:", reservationData.vehiclePlate);
      } catch (vehicleError) {
        console.error("Failed to upsert customer vehicle:", vehicleError);
      }
    }

    // Check if edit link should be included
    const includeEditLink = await shouldIncludeEditLink(supabase, instanceId, normalizedPhone);
    
    // Send SMS based on confirmation status with dynamic instance name
    const SMSAPI_TOKEN = Deno.env.get("SMSAPI_TOKEN");
    const reservationUrl = `https://${instanceSettings?.slug}.n2wash.com/res?code=${confirmationCode}`;
    
    // Format date for SMS
    const dateObj = new Date(reservationData.date);
    const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
    const dayName = dayNames[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthName = monthNames[dateObj.getMonth()];
    
    // Different message based on auto-confirm setting, include maps link if available, use dynamic instance name
    const mapsLinkPart = googleMapsUrl ? ` Dojazd: ${googleMapsUrl}` : "";
    const editLinkPart = includeEditLink ? ` Zmien lub anuluj: ${reservationUrl}` : "";
    
    // Format: "7 stycznia" instead of "7 sty"
    const monthNamesFull = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
    const monthNameFull = monthNamesFull[dateObj.getMonth()];
    
    const smsMessage = autoConfirm 
      ? `${instanceName}: Rezerwacja potwierdzona! ${dayNum} ${monthNameFull} o ${reservationData.time}.${mapsLinkPart}${editLinkPart}`
      : `${instanceName}: Otrzymalismy prosbe o rezerwacje: ${dayNum} ${monthNameFull} o ${reservationData.time}. Potwierdzimy ja wkrotce.${editLinkPart}`;
    
    if (SMSAPI_TOKEN) {
      try {
        const smsResponse = await fetch("https://api.smsapi.pl/sms.do", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SMSAPI_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            to: normalizedPhone,
            message: smsMessage,
            format: "json",
            encoding: "utf-8",
          }),
        });
        
        const smsResult = await smsResponse.json();
        console.log("Reservation SMS sent:", smsResult);
        
        // Log SMS
        const messageType = autoConfirm ? 'confirmation' : 'pending_confirmation';
        await supabase.from('sms_logs').insert({
          instance_id: instanceId,
          phone: normalizedPhone,
          message: smsMessage,
          message_type: messageType,
          reservation_id: reservation?.id,
          customer_id: customerId,
          status: smsResult.error ? 'failed' : 'sent',
          error_message: smsResult.error ? JSON.stringify(smsResult.error) : null,
          smsapi_response: smsResult,
        });
      } catch (smsError) {
        console.error("Failed to send reservation SMS:", smsError);
        
        // Log failed SMS
        await supabase.from('sms_logs').insert({
          instance_id: instanceId,
          phone: normalizedPhone,
          message: smsMessage,
          message_type: autoConfirm ? 'confirmation' : 'pending_confirmation',
          reservation_id: reservation?.id,
          customer_id: customerId,
          status: 'failed',
          error_message: smsError instanceof Error ? smsError.message : 'Unknown error',
        });
      }
    } else {
      console.log(`[DEV MODE] Would send SMS to ${normalizedPhone}: ${smsMessage}`);
      
      // Log simulated SMS
      await supabase.from('sms_logs').insert({
        instance_id: instanceId,
        phone: normalizedPhone,
        message: smsMessage,
        message_type: autoConfirm ? 'confirmation' : 'pending_confirmation',
        reservation_id: reservation?.id,
        customer_id: customerId,
        status: 'simulated',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservation: {
          id: reservation.id,
          confirmationCode,
          date: reservationData.date,
          time: reservationData.time,
          endTime,
          serviceName: serviceData?.name,
          reservationUrl,
          status: reservationStatus,
        },
        instance: instanceSettings,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in verify-sms-code:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "verify-sms-code",
      request: req,
      tags: { function: "verify-sms-code" },
    });
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});