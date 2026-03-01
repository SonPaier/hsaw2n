import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildResetEmailHtml = (
  resetUrl: string,
  instance: {
    name?: string;
    logo_url?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    contact_person?: string;
  }
): string => {
  const logoHtml = instance.logo_url
    ? `<div style="text-align:center;padding:30px 0 20px;">
        <img src="${instance.logo_url}" alt="${instance.name || ''}" style="max-height:60px;max-width:200px;" />
      </div>`
    : `<div style="text-align:center;padding:30px 0 20px;">
        <h1 style="font-family:'Inter',Arial,sans-serif;font-size:22px;font-weight:700;color:#111;margin:0;">${instance.name || 'N2Wash'}</h1>
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
      <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;">Dzień dobry,</p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;">otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta${instance.name ? ` w ${instance.name}` : ''}.</p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;">Kliknij poniższy przycisk, aby ustawić nowe hasło:</p>
    </div>
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${resetUrl}" style="display:inline-block;background-color:#111;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;font-family:'Inter',Arial,sans-serif;">Ustaw nowe hasło</a>
    </div>
    <p style="font-size:13px;color:#999;text-align:center;margin-top:16px;">
      Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.
    </p>
    <p style="font-size:12px;color:#999;text-align:center;margin-top:8px;">
      Lub skopiuj link: <a href="${resetUrl}" style="color:#666;word-break:break-all;">${resetUrl}</a>
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, slug, redirectTo } = await req.json();

    if (!email) {
      // Always return success to prevent enumeration
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Password reset request for:", email, "slug:", slug);

    // Look up instance for branding
    let instance: any = {};
    if (slug) {
      const { data: inst } = await supabaseAdmin
        .from("instances")
        .select("name, logo_url, phone, email, address, website, contact_person")
        .eq("slug", slug)
        .single();
      if (inst) instance = inst;
    }

    // SECURITY: Verify the email belongs to a user of THIS instance before generating a reset link
    const trimmedEmail = email.trim().toLowerCase();

    // Find the instance by slug first
    let instanceId: string | null = null;
    if (slug) {
      const { data: instData } = await supabaseAdmin
        .from("instances")
        .select("id")
        .eq("slug", slug)
        .single();
      instanceId = instData?.id || null;
    }

    if (!instanceId) {
      console.log("Instance not found for slug:", slug);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if a profile with this email exists AND belongs to this instance
    const { data: profileMatch } = await supabaseAdmin
      .from("profiles")
      .select("id, instance_id")
      .eq("instance_id", instanceId)
      .ilike("email", trimmedEmail)
      .maybeSingle();

    // Also check user_roles for super_admins (they may not have instance_id on profile)
    const { data: superAdminMatch } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, profiles!inner(email)")
      .eq("role", "super_admin")
      .maybeSingle();

    let allowedUserId: string | null = null;

    if (profileMatch) {
      allowedUserId = profileMatch.id;
    } else if (superAdminMatch) {
      // Check if the super_admin email matches
      const saProfile = superAdminMatch.profiles as any;
      if (saProfile?.email?.toLowerCase() === trimmedEmail) {
        allowedUserId = superAdminMatch.user_id;
      }
    }

    if (!allowedUserId) {
      console.log("No matching user found for email in instance:", slug);
      // Return success to prevent enumeration
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate recovery link via admin API (does NOT send email)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: trimmedEmail,
      options: {
        redirectTo: redirectTo || undefined,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.log("Could not generate link:", linkError?.message);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetUrl = linkData.properties.action_link;
    console.log("Generated reset link for:", email);

    // Build branded email HTML
    const emailBody = buildResetEmailHtml(resetUrl, instance);

    // Get SMTP config
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("Missing SMTP configuration");
      // Still return success to prevent enumeration
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const fromName = instance.name || "N2Wash";

    await client.send({
      from: `${fromName} <${smtpUser}>`,
      to: email.trim(),
      subject: `Resetowanie hasła - ${fromName}`,
      html: emailBody,
    });

    await client.close();
    console.log("Password reset email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-password-reset-email:", error);
    // Return success to prevent enumeration even on errors
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
