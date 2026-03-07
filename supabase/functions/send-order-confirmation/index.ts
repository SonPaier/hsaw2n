import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const deliveryLabels: Record<string, string> = {
  shipping: "Wysyłka",
  pickup: "Odbiór osobisty",
  uber: "Uber",
};

const paymentLabels: Record<string, string> = {
  cod: "Za pobraniem",
  transfer: "Przelew",
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";

const buildEmailHtml = (
  bodyHtml: string,
  instance: { name?: string; email?: string; phone?: string; address?: string; website?: string; contact_person?: string; logo_url?: string },
): string => {
  const logoHtml = instance.logo_url
    ? `<div style="text-align:center;padding:30px 0 20px;">
        <img src="${instance.logo_url}" alt="${instance.name || ""}" style="max-height:60px;max-width:200px;" />
      </div>`
    : `<div style="text-align:center;padding:30px 0 20px;">
        <h1 style="font-family:'Inter',Arial,sans-serif;font-size:22px;font-weight:700;color:#111;margin:0;">${instance.name || ""}</h1>
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
    ${bodyHtml}
  </div>
</td></tr>
<tr><td style="padding:24px 12px 8px;text-align:center;">
  <p style="margin:0 0 6px;font-size:14px;color:#555;font-weight:600;">${instance.name || ""}</p>
  ${instance.contact_person ? `<p style="margin:0 0 10px;font-size:13px;color:#777;">${instance.contact_person}</p>` : ""}
  <div style="font-size:12px;color:#888;line-height:1.8;">
    ${footerParts.join("<br>")}
  </div>
</td></tr>
<tr><td style="padding:20px 12px 30px;text-align:center;border-top:1px solid #e0e0e0;margin-top:16px;">
  <p style="margin:0;font-size:11px;color:#bbb;font-family:'Inter',Arial,sans-serif;">
    Wygenerowano przy użyciu systemu <a href="https://n2wash.com" style="color:#999;text-decoration:underline;">n2wash.com</a>
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("sales_orders")
      .select("*, instances(name, email, phone, address, website, contact_person, logo_url, slug)")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch customer
    const { data: customer } = await supabase
      .from("customers")
      .select("contact_email, email, is_net_payer")
      .eq("id", order.customer_id)
      .single();

    const customerEmail = (customer?.contact_email || customer?.email || "").replace(/^mailto:/i, "").trim();
    if (!customerEmail) {
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isNetPayer = customer?.is_net_payer ?? false;

    // Fetch order items
    const { data: items } = await supabase
      .from("sales_order_items")
      .select("name, quantity, price_net")
      .eq("order_id", orderId)
      .order("sort_order");

    const VAT_RATE = 0.23;
    const inst = order.instances as any;
    const instanceName = inst?.name || "";
    const orderDate = new Date(order.created_at).toLocaleDateString("pl-PL");

    // Build products list HTML
    const productsHtml = (items || [])
      .map((item: any) => {
        const lineTotal = item.price_net * item.quantity;
        const displayPrice = isNetPayer
          ? `${formatCurrency(lineTotal)} netto`
          : `${formatCurrency(lineTotal * (1 + VAT_RATE))} brutto`;
        const qtyLabel = item.quantity > 1 ? ` (x${item.quantity})` : "";
        return `<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#333;">${item.name}${qtyLabel} – ${displayPrice}</p>`;
      })
      .join("\n");

    // Total lines
    const totalNetDisplay = formatCurrency(order.total_net);
    const totalGrossDisplay = formatCurrency(order.total_gross);

    let totalHtml: string;
    if (isNetPayer) {
      totalHtml = `<p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#333;font-weight:600;">Suma całkowita: ${totalNetDisplay} netto</p>`;
    } else {
      totalHtml = `<p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#333;">Suma całkowita: ${totalNetDisplay} netto</p>
<p style="margin:4px 0 0;font-size:15px;line-height:1.7;color:#333;font-weight:600;">Suma całkowita brutto: ${totalGrossDisplay}</p>`;
    }

    const deliveryLabel = deliveryLabels[order.delivery_type] || order.delivery_type || "—";
    const paymentLabel = paymentLabels[order.payment_method] || order.payment_method || "—";

    // Footer contact info
    const contactLines: string[] = [];
    if (instanceName) contactLines.push(`<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#333;font-weight:600;">${instanceName}</p>`);
    if (inst?.phone) contactLines.push(`<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#333;">${inst.phone}</p>`);
    if (inst?.email) contactLines.push(`<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#333;">${inst.email}</p>`);
    if (inst?.website) contactLines.push(`<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#333;"><a href="${inst.website}" style="color:#333;text-decoration:underline;">${inst.website}</a></p>`);

    const bodyHtml = `
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#333;">Dzień dobry,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#333;">Dziękujemy za zakup. Poniżej znajdziesz szczegóły dotyczące Twojego zamówienia:</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;">Data złożenia: ${orderDate}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#333;">Numer zamówienia: ${order.order_number}</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;font-weight:700;">Lista zamówionych produktów:</p>
${productsHtml}
${totalHtml}
<br>
<p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#333;">Sposób dostawy: ${deliveryLabel}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#333;">Sposób płatności: ${paymentLabel}</p>
<p style="margin:16px 0 16px;font-size:15px;line-height:1.7;color:#333;">Dziękujemy za zaufanie i wybór naszych produktów!</p>
${contactLines.join("\n")}`;

    const emailBody = buildEmailHtml(bodyHtml, {
      name: instanceName,
      email: inst?.email || "",
      phone: inst?.phone || "",
      address: inst?.address || "",
      website: inst?.website || "",
      contact_person: inst?.contact_person || "",
      logo_url: inst?.logo_url || "",
    });

    // SMTP
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    });

    const replyTo = inst?.email || smtpUser;
    const fromName = instanceName || "Zamówienia";

    await client.send({
      from: `${fromName} <${smtpUser}>`,
      to: customerEmail,
      replyTo,
      subject: `Potwierdzenie zamówienia ${order.order_number} - ${instanceName}`,
      html: emailBody,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-order-confirmation:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
