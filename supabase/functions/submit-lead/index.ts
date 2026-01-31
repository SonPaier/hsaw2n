import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-instance-slug',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  gdpr_accepted: boolean;
}

interface VehicleData {
  model_id?: string | null;
  custom_model_name?: string;
  car_size?: string;
  mileage?: string;
  paint_color?: string;
  paint_finish?: 'gloss' | 'matte' | null;
}

interface OfferDetails {
  template_ids: string[];
  extra_service_ids?: string[];
  budget_suggestion?: number | null;
  additional_notes?: string;
  planned_date?: string | null;
  duration_selections?: Record<string, number | null>;
}

interface SubmitLeadRequest {
  customer_data: CustomerData;
  vehicle_data: VehicleData;
  offer_details: OfferDetails;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get instance slug from header or referer
    let instanceSlug = req.headers.get('x-instance-slug');
    
    if (!instanceSlug) {
      const referer = req.headers.get('referer') || req.headers.get('origin');
      if (referer) {
        const url = new URL(referer);
        const hostname = url.hostname;
        if (hostname.endsWith('.n2wash.com')) {
          instanceSlug = hostname.replace('.n2wash.com', '').replace('.admin', '');
        }
      }
    }

    if (!instanceSlug) {
      return new Response(
        JSON.stringify({ error: 'Instance slug required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    }

    // Parse request body
    const body: SubmitLeadRequest = await req.json();
    const { customer_data, vehicle_data, offer_details } = body;

    // Validate required fields
    if (!customer_data?.gdpr_accepted) {
      return new Response(
        JSON.stringify({ error: 'GDPR consent is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customer_data?.name || !customer_data?.email || !customer_data?.phone) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!offer_details?.template_ids || offer_details.template_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one template must be selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch instance with contact details for email
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id, name, email, phone, address, website, contact_person, social_instagram, offer_portfolio_url')
      .eq('slug', instanceSlug)
      .eq('active', true)
      .maybeSingle();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate offer number using database function
    const { data: offerNumber, error: offerNumberError } = await supabase
      .rpc('generate_offer_number', { _instance_id: instance.id });

    if (offerNumberError) {
      console.error('Offer number generation error:', offerNumberError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate offer number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare customer data for offer
    const customerDataJson = {
      name: customer_data.name,
      email: customer_data.email,
      phone: customer_data.phone,
    };

    // Prepare vehicle data for offer
    const vehicleDataJson = vehicle_data ? {
      brandModel: vehicle_data.custom_model_name || '',
      mileage: vehicle_data.mileage || '',
      car_size: vehicle_data.car_size || '',
    } : null;

    // Prepare notes - save additional_notes as "Treść zapytania"
    let inquiryNotes = '';
    if (offer_details.additional_notes) {
      inquiryNotes = offer_details.additional_notes;
    }

    // Create offer draft with widget extras and duration selections
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        instance_id: instance.id,
        offer_number: offerNumber,
        status: 'draft',
        source: 'website',
        customer_data: customerDataJson,
        vehicle_data: vehicleDataJson,
        budget_suggestion: offer_details.budget_suggestion || null,
        inquiry_notes: inquiryNotes || null,
        paint_color: vehicle_data?.paint_color || null,
        paint_finish: vehicle_data?.paint_finish || null,
        planned_date: offer_details.planned_date || null,
        total_net: 0,
        total_gross: 0,
        has_unified_services: true,
        widget_selected_extras: offer_details.extra_service_ids || [],
        widget_duration_selections: offer_details.duration_selections || null,
      })
      .select('id, public_token')
      .single();

    if (offerError) {
      console.error('Offer creation error:', offerError);
      return new Response(
        JSON.stringify({ error: 'Failed to create offer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch selected templates to get their default values
    const { data: templates, error: templatesError } = await supabase
      .from('offer_scopes')
      .select('id, name, description, default_warranty, default_payment_terms, default_notes, default_service_info')
      .in('id', offer_details.template_ids);

    if (templatesError) {
      console.error('Templates fetch error:', templatesError);
    }

    // Create offer_options for each selected template (without prices - admin will add them)
    if (templates && templates.length > 0) {
      const optionsToInsert = templates.map((template, index) => ({
        offer_id: offer.id,
        name: template.name,
        description: template.description,
        scope_id: template.id,
        sort_order: index,
        is_selected: false,
        is_upsell: false,
        subtotal_net: 0,
      }));

      const { error: optionsError } = await supabase
        .from('offer_options')
        .insert(optionsToInsert);

      if (optionsError) {
        console.error('Options creation error:', optionsError);
      }
    }

    // Create notification for admin
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        instance_id: instance.id,
        type: 'new_lead',
        title: `Nowe zapytanie z WWW: ${customer_data.name}`,
        description: `${vehicle_data?.custom_model_name || 'Pojazd'} - ${offer_details.template_ids.length} pakiet(ów)`,
        entity_type: 'offer',
        entity_id: offer.id,
      });

    if (notificationError) {
      console.error('Notification creation error:', notificationError);
    }

    // Send confirmation email to customer
    try {
      await sendLeadConfirmationEmail(
        customer_data,
        vehicle_data,
        offer_details,
        instance,
        templates || []
      );
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request - lead was created successfully
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        offer_id: offer.id,
        offer_number: offerNumber 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Format duration in Polish
function formatDuration(months: number): string {
  const years = months / 12;
  if (years === 1) return '1 rok';
  if (years < 5) return `${years} lata`;
  return `${years} lat`;
}

// Helper: Build services list HTML
function buildServicesHtml(
  templates: { id: string; name: string }[],
  durationSelections: Record<string, number | null> | undefined | null
): string {
  return templates.map(t => {
    const duration = durationSelections?.[t.id];
    if (duration === null) {
      return `<li>${t.name} – Nie wiem, proszę o propozycję</li>`;
    } else if (duration !== undefined) {
      return `<li>${t.name} (${formatDuration(duration)})</li>`;
    }
    return `<li>${t.name}</li>`;
  }).join('\n');
}

// Helper: Build portfolio links HTML
function buildPortfolioLinksHtml(instagram: string | null, portfolioUrl: string | null): string {
  const links: string[] = [];
  if (instagram) {
    links.push(`<a href="${instagram}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background-color: #E1306C; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">📸 Instagram</a>`);
  }
  if (portfolioUrl) {
    links.push(`<a href="${portfolioUrl}" style="display: inline-block; margin: 0 8px; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">🖼️ Nasze realizacje</a>`);
  }
  return links.join('\n');
}

// Send lead confirmation email
async function sendLeadConfirmationEmail(
  customerData: CustomerData,
  vehicleData: VehicleData | undefined,
  offerDetails: OfferDetails,
  instance: { id: string; name: string; email: string | null; phone: string | null; address: string | null; website: string | null; contact_person: string | null; social_instagram: string | null; offer_portfolio_url: string | null },
  templates: { id: string; name: string }[]
): Promise<void> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('SMTP not configured, skipping confirmation email');
    return;
  }

  // Build vehicle info
  const vehicleParts: string[] = [];
  if (vehicleData?.custom_model_name) vehicleParts.push(vehicleData.custom_model_name);
  if (vehicleData?.paint_color) vehicleParts.push(vehicleData.paint_color);
  if (vehicleData?.paint_finish) vehicleParts.push(vehicleData.paint_finish === 'matte' ? 'mat' : 'połysk');
  const vehicleInfo = vehicleParts.length > 0 ? vehicleParts.join(', ') : 'Nie podano';

  // Build services HTML
  const servicesHtml = buildServicesHtml(templates, offerDetails.duration_selections);

  // Build extras section (if any)
  let extrasSection = '';
  if (offerDetails.extra_service_ids && offerDetails.extra_service_ids.length > 0) {
    extrasSection = `<div style="font-size:12px;color:#666;text-transform:uppercase;margin-bottom:4px;">Dodatki</div><div style="font-size:14px;margin-bottom:12px;">${offerDetails.extra_service_ids.length} dodatkowych usług</div>`;
  }

  // Build budget section
  let budgetSection = '';
  if (offerDetails.budget_suggestion) {
    budgetSection = `<div style="font-size:12px;color:#666;text-transform:uppercase;margin-bottom:4px;">Budżet</div><div style="font-size:14px;margin-bottom:12px;">${offerDetails.budget_suggestion.toLocaleString('pl-PL')} zł</div>`;
  }

  // Build notes section
  let notesSection = '';
  if (offerDetails.additional_notes) {
    notesSection = `<div style="font-size:12px;color:#666;text-transform:uppercase;margin-bottom:4px;">Twoje uwagi</div><div style="font-size:14px;margin-bottom:12px;">${offerDetails.additional_notes}</div>`;
  }

  // Build portfolio section
  let portfolioSection = '';
  const portfolioLinksHtml = buildPortfolioLinksHtml(instance.social_instagram, instance.offer_portfolio_url);
  if (portfolioLinksHtml) {
    portfolioSection = `<div style="background-color:#f0f4f8;border-radius:8px;padding:16px;margin:20px 0;text-align:center;"><p style="margin:0 0 8px 0;font-weight:500;">Zapraszamy do odwiedzenia naszego portfolio:</p><div style="margin-top:12px;">${portfolioLinksHtml}</div></div>`;
  }

  // Build footer rows
  const phoneRow = instance.phone ? `<div style="margin-bottom:8px;">📞 ${instance.phone}</div>` : '';
  const addressRow = instance.address ? `<div style="margin-bottom:8px;">📍 ${instance.address}</div>` : '';
  const websiteRow = instance.website ? `<div style="margin-bottom:8px;">🌐 <a href="${instance.website}" style="color:#2563eb;text-decoration:none;">${instance.website}</a></div>` : '';

  const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;"><div style="max-width:600px;margin:0 auto;padding:20px;"><p>Dzień dobry <strong>${customerData.name}</strong>,</p><p>dziękujemy za przesłanie zapytania! Poniżej znajdziesz podsumowanie Twojego zgłoszenia.</p><div style="background-color:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;"><div style="font-size:12px;color:#666;text-transform:uppercase;margin-bottom:4px;">Pojazd</div><div style="font-size:14px;margin-bottom:12px;">${vehicleInfo}</div><div style="font-size:12px;color:#666;text-transform:uppercase;margin-bottom:4px;">Wybrane usługi</div><ul style="margin:0 0 12px 0;padding-left:20px;">${servicesHtml}</ul>${extrasSection}${budgetSection}${notesSection}</div><p>Twoje zapytanie zostało przekazane do naszego zespołu. Skontaktujemy się z Tobą wkrótce z indywidualną wyceną.</p>${portfolioSection}<div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e5e5;font-size:13px;color:#666;"><p style="margin-bottom:15px;">Pozdrawiamy serdecznie,<br><strong>${instance.name}</strong>${instance.contact_person ? `<br>${instance.contact_person}` : ''}</p>${phoneRow}${addressRow}${websiteRow}</div><div style="margin-top:20px;padding-top:15px;border-top:1px solid #e5e5e5;font-size:10px;color:#999;text-align:center;">Email generowany automatycznie przy użyciu systemu CRM dla studiów detailingu i myjni n2wash.com</div></div></body></html>`;

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

  try {
    await client.send({
      from: `${instance.name} <${smtpUser}>`,
      to: customerData.email,
      replyTo: instance.email || smtpUser,
      subject: `${instance.name} - Potwierdzenie zapytania`,
      html: emailHtml,
    });
    console.log('Confirmation email sent to:', customerData.email);
  } finally {
    await client.close();
  }
}
