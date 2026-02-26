import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhoneOrFallback } from "../_shared/phoneUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TODO: Superadmin będzie mógł edytować szablony SMS w panelu superadmina
// Na razie hardcoded templates
const SMS_TEMPLATES: Record<string, string> = {
  serwis: '{short_name}: Zapraszamy na serwis pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
  kontrola: '{short_name}: Zapraszamy na bezplatna kontrole pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
  serwis_gwarancyjny: '{short_name}: Zapraszamy na serwis gwarancyjny pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
  odswiezenie_powloki: '{short_name}: Zapraszamy na odswiezenie powloki pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
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

    // Fetch due reminders from customer_reminders table
    const { data: reminders, error: fetchError } = await supabase
      .from("customer_reminders")
      .select("*, instances(short_name, reservation_phone, timezone)")
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
        const instance = reminder.instances;
        if (!instance) {
          console.error(`Instance not found for reminder ${reminder.id}`);
          continue;
        }

        // Get SMS template based on service_type (hardcoded for now)
        const template = SMS_TEMPLATES[reminder.service_type] || SMS_TEMPLATES.serwis;
        
        // Build SMS message
        let message = template;
        message = message.replace("{short_name}", instance.short_name || "");
        message = message.replace("{vehicle_plate}", reminder.vehicle_plate || "");
        message = message.replace("{reservation_phone}", (instance.reservation_phone || "").replace(/\s/g, ""));

        // Normalize phone number
        const normalizedPhone = normalizePhoneOrFallback(reminder.customer_phone, "PL");
        console.log(`Normalized phone: ${reminder.customer_phone} -> ${normalizedPhone}`);

        // Validate phone number length
        const digitsOnly = normalizedPhone.replace(/\D/g, "");
        if (digitsOnly.length < 11 || digitsOnly.length > 15) {
          console.error(`Invalid phone for reminder ${reminder.id}: ${normalizedPhone} (${digitsOnly.length} digits)`);
          await supabase
            .from("customer_reminders")
            .update({ status: "failed" })
            .eq("id", reminder.id);
          continue;
        }

        // Demo instance - simulate SMS
        const DEMO_INSTANCE_IDS = ['b3c29bfe-f393-4e1a-a837-68dd721df420'];
        if (DEMO_INSTANCE_IDS.includes(reminder.instance_id)) {
          console.log(`[DEMO] Simulating SMS to ${normalizedPhone}: ${message}`);
        } else if (smsApiToken) {
          // Send SMS if token available
          const smsResponse = await fetch("https://api.smsapi.pl/sms.do", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${smsApiToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              to: normalizedPhone.replace("+", ""),
              message: message,
              from: "N2Wash.com",
              format: "json",
            }),
          });

          if (!smsResponse.ok) {
            console.error(`SMS API error for reminder ${reminder.id}`);
            await supabase
              .from("customer_reminders")
              .update({ status: "failed" })
              .eq("id", reminder.id);
            continue;
          }
        } else {
          console.log(`[DEV] Would send SMS to ${normalizedPhone}: ${message}`);
        }

        // Update reminder status
        await supabase
          .from("customer_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);

        // Log SMS
        await supabase.from("sms_logs").insert({
          instance_id: reminder.instance_id,
          phone: normalizedPhone,
          message: message,
          status: "sent",
          type: "customer_reminder",
        });

        sentCount++;
        console.log(`Sent reminder ${reminder.id} to ${normalizedPhone}`);
      } catch (err) {
        console.error(`Error processing reminder ${reminder.id}:`, err);
        await supabase
          .from("customer_reminders")
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
