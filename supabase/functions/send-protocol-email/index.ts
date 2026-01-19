import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  protocolId: string;
  recipientEmail: string;
  subject: string;
  message: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { protocolId, recipientEmail, subject, message }: EmailRequest = await req.json();

    // Fetch protocol with instance data
    const { data: protocol, error: protocolError } = await supabaseClient
      .from("vehicle_protocols")
      .select(`
        *,
        instances:instance_id (
          name,
          slug,
          email,
          phone,
          address,
          website,
          contact_person
        )
      `)
      .eq("id", protocolId)
      .single();

    if (protocolError || !protocol) {
      throw new Error("Protocol not found");
    }

    const instance = protocol.instances;
    const publicUrl = `https://${instance.slug}.n2wash.com/protocols/${protocol.public_token}`;

    // Build email HTML with company footer matching offer emails
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .content { padding: 20px 0; }
          .button { 
            display: inline-block; 
            background-color: #000; 
            color: #fff !important; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e5e5; 
            font-size: 13px; 
            color: #666; 
          }
          .footer-row { margin-bottom: 8px; }
          a { color: #2563eb; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <p>${message.replace(/\n/g, '<br>').replace('[Link do protokołu zostanie automatycznie dołączony]', '')}</p>
            <p style="text-align: center;">
              <a href="${publicUrl}" class="button">Zobacz protokół</a>
            </p>
            <p style="font-size: 12px; color: #666; text-align: center;">
              Lub skopiuj link: <a href="${publicUrl}">${publicUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p style="margin-bottom: 15px;">Pozdrawiamy serdecznie,<br><strong>${instance.name}</strong>${instance.contact_person ? `<br>${instance.contact_person}` : ''}</p>
            ${instance.phone ? `<div class="footer-row">📞 ${instance.phone}</div>` : ''}
            ${instance.address ? `<div class="footer-row">📍 ${instance.address}</div>` : ''}
            ${instance.website ? `<div class="footer-row">🌐 <a href="${instance.website}">${instance.website}</a></div>` : ''}
            ${instance.email ? `<div class="footer-row">📧 ${instance.email}</div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    // Get SMTP config from secrets
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("Missing SMTP configuration");
      throw new Error("SMTP not configured");
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

    const replyTo = instance.email || smtpUser;
    const fromName = instance.name || "Protokoły";

    console.log("Sending email from:", fromName, smtpUser, "to:", recipientEmail);

    await client.send({
      from: `${fromName} <${smtpUser}>`,
      to: recipientEmail,
      replyTo: replyTo,
      subject: subject,
      html: htmlContent,
    });

    await client.close();

    console.log("Email sent successfully, updating protocol");

    // Update protocol with sent timestamp
    await supabaseClient
      .from("vehicle_protocols")
      .update({ 
        customer_email: recipientEmail,
        status: 'sent'
      })
      .eq("id", protocolId);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error sending protocol email:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
