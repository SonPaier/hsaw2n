import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

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
  reminder_1day_sent: boolean | null;
  reminder_1hour_sent: boolean | null;
}

interface Service {
  name: string;
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
    const nowPlus1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const nowPlus24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    console.log("Checking for reminders at:", now.toISOString());
    console.log("1 hour window:", nowPlus1Hour.toISOString());
    console.log("24 hour window:", nowPlus24Hours.toISOString());

    // Get reservations that need 1-day reminder (24 hours before)
    const { data: dayReminders, error: dayError } = await supabase
      .from("reservations")
      .select("id, customer_phone, customer_name, reservation_date, start_time, instance_id, service_id, reminder_1day_sent")
      .eq("status", "confirmed")
      .is("reminder_1day_sent", null)
      .gte("reservation_date", now.toISOString().split("T")[0])
      .lte("reservation_date", nowPlus24Hours.toISOString().split("T")[0]);

    if (dayError) {
      console.error("Error fetching day reminders:", dayError);
    }

    // Get reservations that need 1-hour reminder
    const { data: hourReminders, error: hourError } = await supabase
      .from("reservations")
      .select("id, customer_phone, customer_name, reservation_date, start_time, instance_id, service_id, reminder_1hour_sent")
      .eq("status", "confirmed")
      .is("reminder_1hour_sent", null)
      .eq("reservation_date", now.toISOString().split("T")[0]);

    if (hourError) {
      console.error("Error fetching hour reminders:", hourError);
    }

    let sentCount = 0;
    const results: { type: string; reservationId: string; success: boolean }[] = [];

    // Process 1-day reminders
    for (const reservation of (dayReminders || []) as Reservation[]) {
      const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.start_time}`);
      const timeDiff = reservationDateTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // Send if between 23 and 25 hours before
      if (hoursDiff >= 23 && hoursDiff <= 25) {
        // Get service name
        const { data: service } = await supabase
          .from("services")
          .select("name")
          .eq("id", reservation.service_id)
          .single() as { data: Service | null };

        const serviceName = service?.name || "wizyta";
        const formattedDate = new Date(reservation.reservation_date).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "long",
        });
        const formattedTime = reservation.start_time.slice(0, 5);

        const message = `Przypomnienie: jutro o ${formattedTime} masz wizyte - ${serviceName}. ARM CAR AUTO SPA`;

        const success = await sendSms(reservation.customer_phone, message, smsapiToken);
        
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
    }

    // Process 1-hour reminders
    for (const reservation of (hourReminders || []) as Reservation[]) {
      const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.start_time}`);
      const timeDiff = reservationDateTime.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      // Send if between 55 and 65 minutes before
      if (minutesDiff >= 55 && minutesDiff <= 65) {
        const formattedTime = reservation.start_time.slice(0, 5);

        const message = `Przypomnienie: za godzine o ${formattedTime} masz wizyte. Do zobaczenia! ARM CAR AUTO SPA`;

        const success = await sendSms(reservation.customer_phone, message, smsapiToken);
        
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

async function sendSms(phone: string, message: string, token: string): Promise<boolean> {
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
      return false;
    }

    return true;
  } catch (error) {
    console.error("SMS send error:", error);
    return false;
  }
}
