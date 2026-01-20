import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DirectReservationRequest {
  instanceId: string;
  phone: string;
  reservationData: {
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
  
  // Normalize phone for comparison - handle various prefix formats
  let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
  normalizedPhone = normalizedPhone.replace(/\++/g, "+");
  
  if (!normalizedPhone.startsWith("+")) {
    if (normalizedPhone.startsWith("48") && normalizedPhone.length >= 11) {
      normalizedPhone = "+" + normalizedPhone;
    } else if (normalizedPhone.startsWith("0048")) {
      normalizedPhone = "+48" + normalizedPhone.slice(4);
    } else {
      normalizedPhone = "+48" + normalizedPhone;
    }
  } else if (normalizedPhone.startsWith("+0048")) {
    normalizedPhone = "+48" + normalizedPhone.slice(5);
  }
  
  // Check if phone is in allowed list
  return params.phones.some(p => {
    let normalizedAllowed = p.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    normalizedAllowed = normalizedAllowed.replace(/\++/g, "+");
    
    if (!normalizedAllowed.startsWith("+")) {
      if (normalizedAllowed.startsWith("48") && normalizedAllowed.length >= 11) {
        normalizedAllowed = "+" + normalizedAllowed;
      } else if (normalizedAllowed.startsWith("0048")) {
        normalizedAllowed = "+48" + normalizedAllowed.slice(4);
      } else {
        normalizedAllowed = "+48" + normalizedAllowed;
      }
    } else if (normalizedAllowed.startsWith("+0048")) {
      normalizedAllowed = "+48" + normalizedAllowed.slice(5);
    }
    return normalizedPhone === normalizedAllowed;
  });
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, phone, reservationData }: DirectReservationRequest = await req.json();

    if (!instanceId || !phone || !reservationData) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Normalize phone - handle various prefix formats to avoid duplicates like +4848...
    let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    normalizedPhone = normalizedPhone.replace(/\++/g, "+");
    
    if (!normalizedPhone.startsWith("+")) {
      if (normalizedPhone.startsWith("48") && normalizedPhone.length >= 11) {
        normalizedPhone = "+" + normalizedPhone;
      } else if (normalizedPhone.startsWith("0048")) {
        normalizedPhone = "+48" + normalizedPhone.slice(4);
      } else {
        normalizedPhone = "+48" + normalizedPhone;
      }
    } else if (normalizedPhone.startsWith("+0048")) {
      normalizedPhone = "+48" + normalizedPhone.slice(5);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if customer exists and is verified
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, phone_verified, name")
      .eq("phone", normalizedPhone)
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (customerError) {
      console.error("Customer lookup error:", customerError);
      return new Response(
        JSON.stringify({ error: "Failed to check customer" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!customer || !customer.phone_verified) {
      console.log("Customer not verified:", { customer, normalizedPhone, instanceId });
      return new Response(
        JSON.stringify({ error: "Customer not verified", requiresVerification: true }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Customer is verified - create reservation directly
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

    // Check instance auto_confirm setting
    const { data: instanceSettings } = await supabase
      .from("instances")
      .select("auto_confirm_reservations")
      .eq("id", instanceId)
      .single();

    const autoConfirm = instanceSettings?.auto_confirm_reservations !== false;
    const reservationStatus = autoConfirm ? "confirmed" : "pending";

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
        customer_notes: reservationData.notes || null,
        confirmation_code: confirmationCode,
        car_size: reservationData.carSize || null,
        status: reservationStatus,
        source: "customer",
      })
      .select()
      .single();

    // Create notification for new reservation
    try {
      const dateObj = new Date(reservationData.date);
      const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
      const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
      const dayName = dayNames[dateObj.getDay()];
      const dayNum = dateObj.getDate();
      const monthName = monthNames[dateObj.getMonth()];
      
      await supabase
        .from("notifications")
        .insert({
          instance_id: instanceId,
          type: "reservation_new",
          title: `Nowa rezerwacja: ${reservationData.customerName}`,
          description: `${serviceData?.name || 'Usługa'} - ${dayName} ${dayNum} ${monthName} o ${reservationData.time}`,
          entity_type: "reservation",
          entity_id: reservation?.id,
        });
      console.log("Notification created for new reservation");

      // Send push notification to admins
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            instanceId,
            title: `Nowa rezerwacja`,
            body: `${reservationData.customerName} - ${dayName} ${dayNum} ${monthName} o ${reservationData.time}`,
            url: `/admin?reservationCode=${confirmationCode}`,
            tag: `reservation-${confirmationCode}`,
          }),
        });
        const pushResult = await pushResponse.json();
        console.log("Push notification sent:", pushResult);
      } catch (pushError) {
        console.error("Failed to send push notification:", pushError);
      }
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    if (reservationError) {
      console.error("Reservation error:", reservationError);
      return new Response(
        JSON.stringify({ error: "Failed to create reservation" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Upsert customer vehicle for future suggestions
    if (reservationData.vehiclePlate && reservationData.vehiclePlate !== "BRAK") {
      try {
        await supabase.rpc("upsert_customer_vehicle", {
          _instance_id: instanceId,
          _phone: normalizedPhone,
          _model: reservationData.vehiclePlate,
          _plate: null,
          _customer_id: customer.id,
        });
        console.log("Customer vehicle upserted:", reservationData.vehiclePlate);
        
        // Save custom car model as proposal (silently)
        // Parse brand from vehicle plate (first word is usually brand)
        const parts = reservationData.vehiclePlate.trim().split(/\s+/);
        const brand = parts[0] || 'Do weryfikacji';
        const name = parts.length > 1 ? parts.slice(1).join(' ') : reservationData.vehiclePlate;
        const size = reservationData.carSize === 'small' ? 'S' : reservationData.carSize === 'large' ? 'L' : 'M';
        
        await supabase
          .from('car_models')
          .upsert({
            brand,
            name: name || brand,
            size,
            status: 'proposal',
            active: true,
          }, { 
            onConflict: 'brand,name',
            ignoreDuplicates: true 
          });
        console.log("Car model proposal saved:", { brand, name, size });
      } catch (vehicleError) {
        console.error("Failed to upsert customer vehicle:", vehicleError);
        // Non-critical, continue
      }
    }

    // Update customer name if changed
    if (customer.name !== reservationData.customerName) {
      await supabase
        .from("customers")
        .update({ name: reservationData.customerName })
        .eq("id", customer.id);
    }

    // Fetch instance info including slug (prefer short_name for SMS)
    const { data: instanceData } = await supabase
      .from("instances")
      .select("social_facebook, social_instagram, name, short_name, slug, google_maps_url")
      .eq("id", instanceId)
      .single();

    const instanceName = instanceData?.short_name || instanceData?.name || "Myjnia";
    const googleMapsUrl = instanceData?.google_maps_url || null;

    // Check if edit link should be included
    const includeEditLink = await shouldIncludeEditLink(supabase, instanceId, normalizedPhone);

    // Send SMS based on confirmation status
    const SMSAPI_TOKEN = Deno.env.get("SMSAPI_TOKEN");
    const reservationUrl = `https://${instanceData?.slug}.n2wash.com/res?code=${confirmationCode}`;
    
    // Format date for SMS
    const dateObj = new Date(reservationData.date);
    const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
    const dayName = dayNames[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthName = monthNames[dateObj.getMonth()];
    
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
          customer_id: customer.id,
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
          customer_id: customer.id,
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
        customer_id: customer.id,
        status: 'simulated',
      });
    }

    console.log("Direct reservation created:", reservation.id);

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
          status: reservationStatus,
          reservationUrl,
        },
        instance: instanceData,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in create-reservation-direct:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "create-reservation-direct",
      request: req,
      tags: { function: "create-reservation-direct" },
    });
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});