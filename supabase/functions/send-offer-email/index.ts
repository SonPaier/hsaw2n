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
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { padding: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 13px; color: #666; }
    .footer-row { margin-bottom: 8px; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Dzień dobry,</p>
      <p>przygotowaliśmy dla Państwa indywidualną ofertę usług Car Detailingu & Wrappingu, dopasowaną do wcześniejszych ustaleń.</p>
      <p>Aby zapoznać się ze szczegółami, prosimy kliknąć poniższy link z ofertą:<br>
      <a href="{{offerUrl}}">{{offerUrl}}</a></p>
      <p>W razie pytań chętnie doradzimy i dopasujemy ofertę do Państwa oczekiwań.</p>
    </div>
    <div class="footer">
      <p style="margin-bottom: 15px;">Pozdrawiamy serdecznie,<br><strong>{{instanceName}}</strong><br>{{contactPerson}}</p>
      <div class="footer-row">📞 {{phone}}</div>
      <div class="footer-row">📍 {{address}}</div>
      <div class="footer-row">🌐 <a href="{{website}}">{{website}}</a></div>
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

    const { offerId, customEmailBody } = await req.json();

    if (!offerId) {
      return new Response(
        JSON.stringify({ error: "offerId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching offer:", offerId);

    // Fetch offer with instance data including contact info
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("*, instances(name, email, slug, phone, address, website, contact_person, offer_email_template)")
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
    const instanceName = offer.instances?.name || "";
    const contactPerson = offer.instances?.contact_person || "";
    const phone = offer.instances?.phone || "";
    const address = offer.instances?.address || "";
    const website = offer.instances?.website || "";

    console.log("Preparing email for:", customerEmail);

    // Helper to convert URLs to clickable links
    const makeLinksClickable = (text: string): string => {
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      return text.replace(urlRegex, '<a href="$1" style="color: #2563eb;">$1</a>');
    };

    let emailBody: string;
    
    if (customEmailBody) {
      // User edited the template - convert plain text to simple HTML with clickable links
      const bodyWithLinks = makeLinksClickable(customEmailBody);
      emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; margin: 0;">${bodyWithLinks}</pre>
  </div>
</body>
</html>`;
    } else {
      // Use template and replace placeholders
      emailBody = offer.instances?.offer_email_template || defaultEmailTemplate;
      emailBody = emailBody
        .replace(/\{\{offerUrl\}\}/g, offerUrl)
        .replace(/\{\{instanceName\}\}/g, instanceName)
        .replace(/\{\{contactPerson\}\}/g, contactPerson)
        .replace(/\{\{phone\}\}/g, phone)
        .replace(/\{\{address\}\}/g, address)
        .replace(/\{\{website\}\}/g, website);
    }

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
    const fromName = instanceName || "Oferty";

    console.log("Sending email from:", fromName, smtpUser, "replyTo:", replyTo);

    await client.send({
      from: `${fromName} <${smtpUser}>`,
      to: customerEmail,
      replyTo: replyTo,
      subject: `Oferta ${offer.offer_number} - ${instanceName}`,
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
