import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhoneOrFallback } from "../_shared/phoneUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smsApiToken = Deno.env.get("SMSAPI_TOKEN");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];

    // Fetch due reminders (instance_id is directly on reminder, no need to join offers)
    const { data: reminders, error: fetchError } = await supabase
      .from("offer_reminders")
      .select("*")
      .lte("scheduled_date", today)
      .eq("status", "scheduled");

    if (fetchError) {
      console.error("Error fetching reminders:", fetchError);
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      console.log("No reminders to send");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${reminders.length} reminders to send`);

    let sentCount = 0;

    for (const reminder of reminders) {
      try {
        // Get instance data
        const { data: instance } = await supabase
          .from("instances")
          .select("short_name, reservation_phone, name")
          .eq("id", reminder.instance_id)
          .single();

        if (!instance) {
          console.error(`Instance not found for reminder ${reminder.id}`);
          continue;
        }

        // Build SMS message from template
        let message = reminder.sms_template || "";
        message = message.replace("{short_name}", instance.short_name || instance.name || "");
        message = message.replace("{service_type}", reminder.service_type || "serwis");
        message = message.replace("{vehicle_info}", reminder.vehicle_info || "");
        message = message.replace("{paid_info}", reminder.is_paid ? "Serwis platny" : "Bezplatna kontrola");
        message = message.replace("{reservation_phone}", (instance.reservation_phone || "").replace(/\s/g, ""));

        // Normalize phone number using libphonenumber-js
        const normalizedPhone = normalizePhoneOrFallback(reminder.customer_phone, "PL");
        console.log(`Normalized phone: ${reminder.customer_phone} -> ${normalizedPhone}`);

        // Validate phone number length
        const digitsOnly = normalizedPhone.replace(/\D/g, "");
        if (digitsOnly.length < 11 || digitsOnly.length > 15) {
          console.error(`Invalid phone for reminder ${reminder.id}: ${normalizedPhone} (${digitsOnly.length} digits)`);
          await supabase
            .from("offer_reminders")
            .update({ status: "failed" })
            .eq("id", reminder.id);
          continue;
        }

        // Send SMS if token available
        if (smsApiToken) {
          const smsResponse = await fetch("https://api.smsapi.pl/sms.do", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${smsApiToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              to: normalizedPhone.replace("+", ""),
              message: message,
              from: "Info",
              format: "json",
            }),
          });

          if (!smsResponse.ok) {
            console.error(`SMS API error for reminder ${reminder.id}`);
            await supabase
              .from("offer_reminders")
              .update({ status: "failed" })
              .eq("id", reminder.id);
            continue;
          }
        } else {
          console.log(`[DEV] Would send SMS to ${normalizedPhone}: ${message}`);
        }

        // Update reminder status
        await supabase
          .from("offer_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);

        // Log SMS
        await supabase.from("sms_logs").insert({
          instance_id: reminder.instance_id,
          phone: normalizedPhone,
          message: message,
          status: "sent",
          type: "offer_reminder",
        });

        sentCount++;
        console.log(`Sent reminder ${reminder.id} to ${normalizedPhone}`);
      } catch (err) {
        console.error(`Error processing reminder ${reminder.id}:`, err);
        await supabase
          .from("offer_reminders")
          .update({ status: "failed" })
          .eq("id", reminder.id);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, total: reminders.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-offer-reminders:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
