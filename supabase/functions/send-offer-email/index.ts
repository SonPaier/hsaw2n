import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildEmailHtml = (
  body: string,
  instance: { name?: string; email?: string; phone?: string; address?: string; website?: string; contact_person?: string; logo_url?: string; social_facebook?: string; social_instagram?: string },
  offerUrl: string
): string => {
  const logoHtml = instance.logo_url
    ? `<div style="text-align:center;padding:30px 0 20px;">
        <img src="${instance.logo_url}" alt="${instance.name || ''}" style="max-height:60px;max-width:200px;" />
      </div>`
    : `<div style="text-align:center;padding:30px 0 20px;">
        <h1 style="font-family:'Inter',Arial,sans-serif;font-size:22px;font-weight:700;color:#111;margin:0;">${instance.name || ''}</h1>
      </div>`;

  const footerParts: string[] = [];
  if (instance.phone) footerParts.push(`<span style="margin:0 8px;"><a href="tel:${instance.phone}" style="color:#555;text-decoration:none;">${instance.phone}</a></span>`);
  if (instance.address) footerParts.push(`<span style="margin:0 8px;">${instance.address}</span>`);
  if (instance.website) footerParts.push(`<span style="margin:0 8px;"><a href="${instance.website}" style="color:#555;text-decoration:underline;">${instance.website}</a></span>`);
  if (instance.email) footerParts.push(`<span style="margin:0 8px;">${instance.email}</span>`);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:'Inter',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:20px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td>
  ${logoHtml}
</td></tr>
<tr><td>
  <div style="background:#ffffff;border-radius:12px;padding:36px 32px;margin:0 12px;">
    <div style="font-size:15px;line-height:1.7;color:#333;">
      ${body}
    </div>
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${offerUrl}" style="display:inline-block;background-color:#111;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;font-family:'Inter',Arial,sans-serif;">Zobacz ofertę</a>
    </div>
    <p style="font-size:12px;color:#999;text-align:center;margin-top:16px;">
      Lub skopiuj link: <a href="${offerUrl}" style="color:#666;">${offerUrl}</a>
    </p>
  </div>
</td></tr>
<tr><td style="padding:24px 12px 8px;text-align:center;">
  <p style="margin:0 0 6px;font-size:14px;color:#555;font-weight:600;">${instance.name || ''}</p>
  ${instance.contact_person ? `<p style="margin:0 0 10px;font-size:13px;color:#777;">${instance.contact_person}</p>` : ''}
  <div style="font-size:12px;color:#888;line-height:1.8;">
    ${footerParts.join('<br>')}
  </div>
</td></tr>
<tr><td style="padding:20px 12px 30px;text-align:center;border-top:1px solid #e0e0e0;margin-top:16px;">
  <p style="margin:0;font-size:11px;color:#bbb;font-family:'Inter',Arial,sans-serif;">
    Wygenerowano przy użyciu systemu dla myjni i studio detailingu <a href="https://n2wash.com" style="color:#999;text-decoration:underline;">n2wash.com</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
};

const defaultEmailTemplate = `Dzień dobry,

przygotowaliśmy indywidualną ofertę usług car detailing, zgodnie z Państwa zapytaniem.

W razie pytań chętnie doradzimy i dopasujemy ofertę do Państwa oczekiwań.`;

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
      .select("*, instances(name, email, slug, phone, address, website, contact_person, offer_email_template, logo_url, social_facebook, social_instagram)")
      .eq("id", offerId)
      .single();

    if (offerError || !offer) {
      console.error("Offer fetch error:", offerError);
      return new Response(
        JSON.stringify({ error: "Offer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let customerEmail = offer.customer_data?.email;
    if (customerEmail) {
      // Sanitize: remove mailto: prefix and trim whitespace
      customerEmail = customerEmail.replace(/^mailto:/i, '').trim();
    }
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
      return text.replace(urlRegex, '<a href="$1" style="color:#555;text-decoration:underline;">$1</a>');
    };

    // Build the plain-text body (from custom input or default template with placeholders)
    let plainBody: string;
    
    if (customEmailBody) {
      plainBody = customEmailBody;
    } else {
      plainBody = offer.instances?.offer_email_template || defaultEmailTemplate;
      plainBody = plainBody
        .replace(/\{\{offerUrl\}\}/g, offerUrl)
        .replace(/\{\{instanceName\}\}/g, instanceName)
        .replace(/\{\{contactPerson\}\}/g, contactPerson)
        .replace(/\{\{phone\}\}/g, phone)
        .replace(/\{\{address\}\}/g, address)
        .replace(/\{\{website\}\}/g, website);
    }

    // Convert plain text to HTML paragraphs with clickable links
    const bodyHtml = makeLinksClickable(plainBody)
      .split('\n')
      .map(line => line.trim() === '' ? '<br>' : `<p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;">${line}</p>`)
      .join('\n');

    // Build the full branded email
    const instanceInfo = {
      name: instanceName,
      email: offer.instances?.email || '',
      phone,
      address,
      website,
      contact_person: contactPerson,
      logo_url: offer.instances?.logo_url || '',
      social_facebook: offer.instances?.social_facebook || '',
      social_instagram: offer.instances?.social_instagram || '',
    };

    const emailBody = buildEmailHtml(bodyHtml, instanceInfo, offerUrl);

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
