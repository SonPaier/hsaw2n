import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
          phone
        )
      `)
      .eq("id", protocolId)
      .single();

    if (protocolError || !protocol) {
      throw new Error("Protocol not found");
    }

    const instance = protocol.instances;
    const publicUrl = `https://${instance.slug}.n2wash.com/protocols/${protocol.public_token}`;

    // Build email HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { margin-bottom: 30px; }
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
            border-top: 1px solid #eee; 
            font-size: 12px; 
            color: #666; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${instance.name}</h2>
          </div>
          <div class="content">
            <p>${message.replace(/\n/g, '<br>')}</p>
            <p style="text-align: center;">
              <a href="${publicUrl}" class="button">Zobacz protokół</a>
            </p>
            <p style="font-size: 12px; color: #666;">
              Lub skopiuj link: ${publicUrl}
            </p>
          </div>
          <div class="footer">
            <p>${instance.name}</p>
            ${instance.phone ? `<p>Tel: ${instance.phone}</p>` : ''}
            ${instance.email ? `<p>Email: ${instance.email}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via SMTP
    const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser = "protocols@n2wash.com";
    const smtpPass = Deno.env.get("PROTOCOL_SMTP_PASS") ?? "";

    // Use Resend-like API or direct SMTP
    // Since we're using the same SMTP server, we'll use nodemailer-like approach via fetch
    const response = await fetch(`https://${smtpHost}/api/emails`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${smtpPass}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${instance.name} <protocols@n2wash.com>`,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      // Fallback: try Resend API directly if configured
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${smtpPass}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${instance.name} <protocols@n2wash.com>`,
          to: [recipientEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error("Email send error:", errorText);
        throw new Error(`Failed to send email: ${errorText}`);
      }
    }

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
