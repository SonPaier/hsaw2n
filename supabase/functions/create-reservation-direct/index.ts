import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

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
    const { instanceId, phone, reservationData }: DirectReservationRequest = await req.json();

    if (!instanceId || !phone || !reservationData) {
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

    const confirmationCode = generateConfirmationCode();

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

    // Update customer name if changed
    if (customer.name !== reservationData.customerName) {
      await supabase
        .from("customers")
        .update({ name: reservationData.customerName })
        .eq("id", customer.id);
    }

    // Fetch instance info
    const { data: instanceData } = await supabase
      .from("instances")
      .select("social_facebook, social_instagram, name")
      .eq("id", instanceId)
      .single();

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
        },
        instance: instanceData,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in create-reservation-direct:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
