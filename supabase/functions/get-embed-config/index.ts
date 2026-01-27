import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-instance-slug',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get instance slug from header or referer
    let instanceSlug = req.headers.get('x-instance-slug');
    
    if (!instanceSlug) {
      // Try to extract from referer or origin
      const referer = req.headers.get('referer') || req.headers.get('origin');
      if (referer) {
        const url = new URL(referer);
        const hostname = url.hostname;
        // Extract subdomain: armcar.n2wash.com -> armcar
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

    // Fetch instance data
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id, name, short_name, address, nip, logo_url, offer_bg_color, offer_primary_color, contact_person, phone')
      .eq('slug', instanceSlug)
      .eq('active', true)
      .maybeSingle();

    if (instanceError) {
      console.error('Instance fetch error:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch instance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instance) {
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active offer templates (scopes) with has_unified_services=true
    const { data: templates, error: templatesError } = await supabase
      .from('offer_scopes')
      .select('id, name, short_name, description')
      .eq('instance_id', instance.id)
      .eq('active', true)
      .eq('has_unified_services', true)
      .eq('is_extras_scope', false)
      .order('sort_order', { ascending: true });

    if (templatesError) {
      console.error('Templates fetch error:', templatesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch templates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = {
      branding: {
        bg_color: instance.offer_bg_color || '#f8fafc',
        primary_color: instance.offer_primary_color || '#2563eb',
        logo_url: instance.logo_url || null,
      },
      instance_info: {
        name: instance.name,
        short_name: instance.short_name,
        address: instance.address,
        nip: instance.nip,
        contact_person: instance.contact_person,
        phone: instance.phone,
      },
      templates: (templates || []).map(t => ({
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        description: t.description,
      })),
    };

    return new Response(
      JSON.stringify(response),
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
