import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Fetch instance
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id')
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
