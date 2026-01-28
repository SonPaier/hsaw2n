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
      .select('id, name, short_name, address, nip, logo_url, offer_bg_color, offer_primary_color, contact_person, phone, widget_config')
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

    // Parse widget config
    const widgetConfig = instance.widget_config as {
      visible_templates?: string[];
      extras?: { service_id: string; custom_label: string | null }[];
    } | null;

    const visibleTemplateIds = widgetConfig?.visible_templates || [];

    // Fetch active offer templates (scopes) with has_unified_services=true
    // Filter by visible_templates if configured
    let templatesQuery = supabase
      .from('offer_scopes')
      .select('id, name, short_name, description, price_from')
      .eq('instance_id', instance.id)
      .eq('active', true)
      .eq('has_unified_services', true)
      .eq('is_extras_scope', false)
      .order('sort_order', { ascending: true });

    // If visible_templates is configured, filter by those IDs
    if (visibleTemplateIds.length > 0) {
      templatesQuery = templatesQuery.in('id', visibleTemplateIds);
    }

    const { data: templates, error: templatesError } = await templatesQuery;

    if (templatesError) {
      console.error('Templates fetch error:', templatesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch templates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For each template, fetch products to find unique durability values
    const templateIds = (templates || []).map(t => t.id);
    let templateDurations: Record<string, number[]> = {};
    
    if (templateIds.length > 0) {
      // Fetch scope products to get product IDs
      const { data: scopeProducts } = await supabase
        .from('offer_scope_products')
        .select('scope_id, product_id')
        .in('scope_id', templateIds);

      if (scopeProducts && scopeProducts.length > 0) {
        const productIds = [...new Set(scopeProducts.map(sp => sp.product_id))];
        
        // Fetch product metadata to get durability
        const { data: products } = await supabase
          .from('unified_services')
          .select('id, metadata')
          .in('id', productIds)
          .eq('active', true)
          .is('deleted_at', null);

        if (products) {
          // Build a map of product_id -> durability
          const productDurability: Record<string, number | null> = {};
          for (const p of products) {
            const meta = p.metadata as { trwalosc_produktu_w_mesiacach?: number } | null;
            productDurability[p.id] = meta?.trwalosc_produktu_w_mesiacach || null;
          }

          // Build scope -> durations mapping
          for (const sp of scopeProducts) {
            const durability = productDurability[sp.product_id];
            if (durability && durability > 0) {
              if (!templateDurations[sp.scope_id]) {
                templateDurations[sp.scope_id] = [];
              }
              if (!templateDurations[sp.scope_id].includes(durability)) {
                templateDurations[sp.scope_id].push(durability);
              }
            }
          }

          // Sort durations for each scope
          for (const scopeId of Object.keys(templateDurations)) {
            templateDurations[scopeId].sort((a, b) => a - b);
          }
        }
      }
    }

    // Fetch extras (services with custom labels)
    let extras: { id: string; name: string }[] = [];
    if (widgetConfig?.extras && widgetConfig.extras.length > 0) {
      const serviceIds = widgetConfig.extras.map(e => e.service_id);
      
      const { data: services } = await supabase
        .from('unified_services')
        .select('id, name')
        .in('id', serviceIds)
        .eq('active', true)
        .is('deleted_at', null);

      if (services) {
        // Map services with custom labels
        extras = widgetConfig.extras.map(extra => {
          const service = services.find(s => s.id === extra.service_id);
          return {
            id: extra.service_id,
            name: extra.custom_label || service?.name || 'Usługa',
          };
        });
      }
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
        price_from: t.price_from,
        available_durations: templateDurations[t.id] || [],
      })),
      extras,
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
