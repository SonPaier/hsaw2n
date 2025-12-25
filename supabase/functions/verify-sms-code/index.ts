import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifySmsRequest {
  phone: string;
  code: string;
  instanceId: string;
}

const generateConfirmationCode = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

    const confirmationCode = generateConfirmationCode();

    // Check instance auto_confirm setting
    const { data: instanceSettings } = await supabase
      .from("instances")
      .select("auto_confirm_reservations")
      .eq("id", instanceId)
      .single();

    const autoConfirm = instanceSettings?.auto_confirm_reservations !== false;
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

    if (existingCustomer) {
      // Update existing customer - mark as verified
      await supabase
        .from("customers")
        .update({ 
          phone_verified: true,
          name: reservationData.customerName,
        })
        .eq("id", existingCustomer.id);
    } else {
      // Create new customer with verified phone
      await supabase
        .from("customers")
        .insert({
          instance_id: instanceId,
          phone: normalizedPhone,
          name: reservationData.customerName,
          phone_verified: true,
        });
    }

    // Fetch instance info for social links
    const { data: instanceData } = await supabase
      .from("instances")
      .select("social_facebook, social_instagram, name, slug")
      .eq("id", instanceId)
      .single();

    // Send SMS based on confirmation status
    const SMSAPI_TOKEN = Deno.env.get("SMSAPI_TOKEN");
    const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://armcar.pl";
    const reservationUrl = `${FRONTEND_URL}/moja-rezerwacja?code=${confirmationCode}`;
    
    // Format date for SMS
    const dateObj = new Date(reservationData.date);
    const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
    const dayName = dayNames[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthName = monthNames[dateObj.getMonth()];
    
    // Different message based on auto-confirm setting
    const smsMessage = autoConfirm 
      ? `Rezerwacja potwierdzona! ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthName} o ${reservationData.time}-${endTime}. Szczegóły: ${reservationUrl}`
      : `Rezerwacja przyjęta! ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthName} o ${reservationData.time}. Potwierdzimy ją wkrótce. Szczegóły: ${reservationUrl}`;
    
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
            from: "ARMCAR",
            format: "json",
            encoding: "utf-8",
          }),
        });
        
        const smsResult = await smsResponse.json();
        console.log("Reservation SMS sent:", smsResult);
      } catch (smsError) {
        console.error("Failed to send reservation SMS:", smsError);
      }
    } else {
      console.log(`[DEV MODE] Would send SMS to ${normalizedPhone}: ${smsMessage}`);
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
        instance: instanceData,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in verify-sms-code:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
