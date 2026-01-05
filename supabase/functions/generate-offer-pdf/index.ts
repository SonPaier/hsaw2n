import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OfferOption {
  name: string;
  description?: string;
  subtotal_net: number;
  offer_option_items: {
    custom_name: string;
    quantity: number;
    unit_price: number;
    unit: string;
    discount_percent: number;
    is_optional: boolean;
  }[];
}

interface Offer {
  id: string;
  offer_number: string;
  customer_data: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    nip?: string;
    address?: string;
  };
  vehicle_data?: {
    brand?: string;
    model?: string;
    plate?: string;
    vin?: string;
  };
  total_net: number;
  total_gross: number;
  vat_rate: number;
  notes?: string;
  payment_terms?: string;
  valid_until?: string;
  hide_unit_prices: boolean;
  created_at: string;
  offer_options: OfferOption[];
  instances: {
    name: string;
    logo_url?: string;
    phone?: string;
    email?: string;
    address?: string;
    nip?: string;
    offer_branding_enabled?: boolean;
    offer_bg_color?: string;
    offer_header_bg_color?: string;
    offer_header_text_color?: string;
    offer_section_bg_color?: string;
    offer_section_text_color?: string;
    offer_primary_color?: string;
  };
}

const formatPrice = (value: number): string => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(value);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const generateHtmlContent = (offer: Offer): string => {
  const instance = offer.instances;
  const vatAmount = offer.total_gross - offer.total_net;
  const hideUnitPrices = offer.hide_unit_prices;
  
  // Branding colors with defaults
  const brandingEnabled = instance?.offer_branding_enabled ?? false;
  const primaryColor = brandingEnabled && instance?.offer_primary_color ? instance.offer_primary_color : '#2563eb';
  const bgColor = brandingEnabled && instance?.offer_bg_color ? instance.offer_bg_color : '#ffffff';
  const headerBgColor = brandingEnabled && instance?.offer_header_bg_color ? instance.offer_header_bg_color : '#f8f9fa';
  const headerTextColor = brandingEnabled && instance?.offer_header_text_color ? instance.offer_header_text_color : '#333333';
  
  const optionsHtml = offer.offer_options
    .filter((opt: any) => opt.is_selected !== false)
    .map((option: OfferOption) => {
      // When hiding unit prices, show only item names
      const itemsHtml = hideUnitPrices
        ? option.offer_option_items
            .map((item) => `
              <div style="padding: 6px 0; ${item.is_optional ? 'color: #666; font-style: italic;' : ''}">
                • ${item.custom_name}
                ${item.is_optional ? '<span style="font-size: 10px; margin-left: 8px;">(opcjonalne)</span>' : ''}
              </div>
            `)
            .join('')
        : option.offer_option_items
            .map((item) => {
              const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
              return `
                <tr style="${item.is_optional ? 'color: #666; font-style: italic;' : ''}">
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">
                    ${item.custom_name}
                    ${item.is_optional ? '<span style="font-size: 10px; margin-left: 8px;">(opcjonalne)</span>' : ''}
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity} ${item.unit}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.unit_price)}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.discount_percent > 0 ? `-${item.discount_percent}%` : '—'}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${item.is_optional ? '—' : formatPrice(itemTotal)}</td>
                </tr>
              `;
            })
            .join('');

      // Different layout when hiding unit prices
      if (hideUnitPrices) {
        return `
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${option.name}</h3>
            ${option.description ? `<p style="margin: 0 0 12px 0; font-size: 12px; color: #666;">${option.description}</p>` : ''}
            <div style="font-size: 12px; margin-bottom: 12px;">
              ${itemsHtml}
            </div>
            <div style="text-align: right; font-weight: bold; font-size: 14px; padding-top: 8px; border-top: 2px solid #eee;">
              Cena: ${formatPrice(option.subtotal_net)} netto
            </div>
          </div>
        `;
      }

      return `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">${option.name}</h3>
          ${option.description ? `<p style="margin: 0 0 12px 0; font-size: 12px; color: #666;">${option.description}</p>` : ''}
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Pozycja</th>
                <th style="padding: 8px; text-align: center; width: 80px;">Ilość</th>
                <th style="padding: 8px; text-align: right; width: 100px;">Cena jedn.</th>
                <th style="padding: 8px; text-align: center; width: 60px;">Rabat</th>
                <th style="padding: 8px; text-align: right; width: 100px;">Wartość</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="4" style="padding: 8px; text-align: right;">Razem opcja:</td>
                <td style="padding: 8px; text-align: right;">${formatPrice(option.subtotal_net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.5; background: ${bgColor}; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo { max-height: 60px; }
    .company-info { text-align: right; font-size: 11px; color: ${headerTextColor}; }
    .offer-title { font-size: 24px; font-weight: bold; color: ${primaryColor}; margin-bottom: 8px; }
    .offer-number { font-size: 14px; color: #666; margin-bottom: 24px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
    .info-box { background: ${headerBgColor}; padding: 16px; border-radius: 8px; }
    .info-box h4 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: ${primaryColor}; }
    .info-box p { margin: 4px 0; font-size: 12px; color: ${headerTextColor}; }
    .totals { margin-top: 32px; background: ${headerBgColor}; padding: 20px; border-radius: 8px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
    .totals-row.total { font-size: 18px; font-weight: bold; color: ${primaryColor}; border-top: 2px solid #ddd; padding-top: 16px; margin-top: 8px; }
    .notes { margin-top: 32px; font-size: 11px; color: #666; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${instance?.logo_url ? `<img src="${instance.logo_url}" alt="${instance.name}" class="logo">` : `<h2 style="margin: 0; color: ${primaryColor};">${instance?.name || 'Oferta'}</h2>`}
    </div>
    <div class="company-info">
      <strong>${instance?.name || ''}</strong><br>
      ${instance?.address || ''}<br>
      ${instance?.phone ? `Tel: ${instance.phone}<br>` : ''}
      ${instance?.email ? `Email: ${instance.email}<br>` : ''}
      ${instance?.nip ? `NIP: ${instance.nip}` : ''}
    </div>
  </div>

  <h1 class="offer-title">OFERTA</h1>
  <p class="offer-number">Nr ${offer.offer_number} | Data: ${formatDate(offer.created_at)}</p>

  <div class="info-grid">
    <div class="info-box">
      <h4>Dla</h4>
      <p><strong>${offer.customer_data?.name || ''}</strong></p>
      ${offer.customer_data?.company ? `<p>${offer.customer_data.company}</p>` : ''}
      ${offer.customer_data?.nip ? `<p>NIP: ${offer.customer_data.nip}</p>` : ''}
      ${offer.customer_data?.address ? `<p>${offer.customer_data.address}</p>` : ''}
      ${offer.customer_data?.email ? `<p>${offer.customer_data.email}</p>` : ''}
      ${offer.customer_data?.phone ? `<p>${offer.customer_data.phone}</p>` : ''}
    </div>
    ${offer.vehicle_data?.brand ? `
    <div class="info-box">
      <h4>Pojazd</h4>
      <p><strong>${offer.vehicle_data.brand} ${offer.vehicle_data.model || ''}</strong></p>
      ${offer.vehicle_data.plate ? `<p>Nr rej.: ${offer.vehicle_data.plate}</p>` : ''}
      ${offer.vehicle_data.vin ? `<p>VIN: ${offer.vehicle_data.vin}</p>` : ''}
    </div>
    ` : ''}
  </div>

  ${optionsHtml}

  <div class="totals">
    <div class="totals-row">
      <span>Suma netto</span>
      <span>${formatPrice(offer.total_net)}</span>
    </div>
    <div class="totals-row">
      <span>VAT (${offer.vat_rate}%)</span>
      <span>${formatPrice(vatAmount)}</span>
    </div>
    <div class="totals-row total">
      <span>RAZEM BRUTTO</span>
      <span>${formatPrice(offer.total_gross)}</span>
    </div>
  </div>

  ${offer.valid_until || offer.payment_terms || offer.notes ? `
  <div class="notes">
    ${offer.valid_until ? `<p><strong>Oferta ważna do:</strong> ${formatDate(offer.valid_until)}</p>` : ''}
    ${offer.payment_terms ? `<p><strong>Warunki płatności:</strong> ${offer.payment_terms}</p>` : ''}
    ${offer.notes ? `<p style="margin-top: 12px; white-space: pre-wrap;">${offer.notes}</p>` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>Dokument wygenerowany automatycznie | ${instance?.name || ''}</p>
  </div>
</body>
</html>
  `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerId, token } = await req.json();
    
    if (!offerId && !token) {
      throw new Error('Missing offerId or token');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('offers')
      .select(`
        *,
        offer_options (
          *,
          offer_option_items (*)
        ),
        instances (
          name,
          logo_url,
          phone,
          email,
          address,
          nip,
          offer_branding_enabled,
          offer_bg_color,
          offer_header_bg_color,
          offer_header_text_color,
          offer_section_bg_color,
          offer_section_text_color,
          offer_primary_color
        )
      `);

    if (token) {
      query = query.eq('public_token', token);
    } else {
      query = query.eq('id', offerId);
    }

    const { data: offer, error } = await query.single();

    if (error || !offer) {
      console.error('Error fetching offer:', error);
      return new Response(
        JSON.stringify({ error: 'Offer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = generateHtmlContent(offer as unknown as Offer);

    // Use docraptor-like approach with base64 encoding for simple PDF generation
    // Since we can't use external PDF services easily, we'll use a data URI approach
    // that works in browsers - the browser will print to PDF
    
    // For true PDF, we'll use the jsPDF approach via the browser
    // Return HTML with PDF headers so the browser offers to download/print
    const pdfReadyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Oferta ${offer.offer_number}</title>
  <style>
    @media print {
      @page { size: A4; margin: 15mm; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body onload="window.print()">
${html.replace('<!DOCTYPE html>', '').replace(/<html[^>]*>/, '').replace(/<\/html>/, '').replace(/<head>[\s\S]*<\/head>/, '').replace(/<body>/, '').replace(/<\/body>/, '')}
</body>
</html>
    `;

    return new Response(pdfReadyHtml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="Oferta_${offer.offer_number.replace(/\//g, '-')}.html"`,
      },
    });

  } catch (error: unknown) {
    console.error('Error generating PDF:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
