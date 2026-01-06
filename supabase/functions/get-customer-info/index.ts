import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CustomerInfoRequest {
  phone: string;
  instanceId: string;
}

interface CustomerInfoResponse {
  isVerified: boolean;
  name: string | null;
  vehicles: { model: string; usage_count: number }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, instanceId } = await req.json() as CustomerInfoRequest;

    // Validate inputs
    if (!phone || !instanceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone and instanceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+48' + normalizedPhone;
    }

    // Validate phone format (basic check)
    if (normalizedPhone.length < 11 || normalizedPhone.length > 15) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, phone_verified')
      .eq('phone', normalizedPhone)
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      throw customerError;
    }

    // Fetch customer vehicles
    const phoneWithoutPrefix = normalizedPhone.replace('+48', '');
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('customer_vehicles')
      .select('model, usage_count')
      .eq('instance_id', instanceId)
      .or(`phone.eq.${normalizedPhone},phone.eq.${phoneWithoutPrefix}`)
      .order('usage_count', { ascending: false })
      .limit(5);

    if (vehiclesError) {
      console.error('Error fetching vehicles:', vehiclesError);
      throw vehiclesError;
    }

    const response: CustomerInfoResponse = {
      isVerified: customer?.phone_verified === true,
      name: customer?.name || null,
      vehicles: vehicles?.map(v => ({ model: v.model, usage_count: v.usage_count })) || []
    };

    console.log(`Customer info fetched for phone ${normalizedPhone.slice(-4)}: verified=${response.isVerified}, vehicles=${response.vehicles.length}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-customer-info:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
