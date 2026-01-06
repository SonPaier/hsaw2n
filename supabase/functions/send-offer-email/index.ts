import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const defaultEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Oferta {{offerNumber}}</h1>
    </div>
    <p>Dzień dobry {{customerName}},</p>
    <p>Przygotowaliśmy dla Ciebie indywidualną ofertę. Kliknij poniższy przycisk, aby ją zobaczyć:</p>
    <p style="text-align: center;">
      <a href="{{offerUrl}}" class="button">Zobacz ofertę</a>
    </p>
    <p>Link do oferty: <a href="{{offerUrl}}">{{offerUrl}}</a></p>
    <div class="footer">
      <p>Pozdrawiamy,<br>{{instanceName}}</p>
    </div>
  </div>
</body>
</html>
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { offerId } = await req.json();

    if (!offerId) {
      return new Response(
        JSON.stringify({ error: "offerId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching offer:", offerId);

    // Fetch offer with instance data
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("*, instances(name, email, slug, offer_email_template)")
      .eq("id", offerId)
      .single();

    if (offerError || !offer) {
      console.error("Offer fetch error:", offerError);
      return new Response(
        JSON.stringify({ error: "Offer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerEmail = offer.customer_data?.email;
    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: "No customer email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate offer URL - use public subdomain
    const instanceSlug = offer.instances?.slug || "app";
    const offerUrl = `https://${instanceSlug}.n2wash.com/offers/${offer.public_token}`;
    const customerName = offer.customer_data?.name || "Szanowny Kliencie";

    console.log("Preparing email for:", customerEmail);

    // Build email content from template
    let emailBody = offer.instances?.offer_email_template || defaultEmailTemplate;
    emailBody = emailBody
      .replace(/\{\{customerName\}\}/g, customerName)
      .replace(/\{\{offerNumber\}\}/g, offer.offer_number)
      .replace(/\{\{offerUrl\}\}/g, offerUrl)
      .replace(/\{\{instanceName\}\}/g, offer.instances?.name || "");

    // Get SMTP config from secrets
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("Missing SMTP configuration");
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Connecting to SMTP:", smtpHost, smtpPort);

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    const replyTo = offer.instances?.email || smtpUser;

    console.log("Sending email from:", smtpUser, "replyTo:", replyTo);

    await client.send({
      from: smtpUser,
      to: customerEmail,
      replyTo: replyTo,
      subject: `Oferta ${offer.offer_number} - ${offer.instances?.name || ""}`,
      html: emailBody,
    });

    await client.close();

    console.log("Email sent successfully, updating offer status");

    // Update offer status to sent
    const { error: updateError } = await supabase
      .from("offers")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", offerId);

    if (updateError) {
      console.error("Error updating offer status:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-offer-email:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
