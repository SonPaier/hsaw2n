import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedProduct {
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  unit?: string;
  default_price: number;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { priceListId, fileContent, fileName } = await req.json();

    if (!priceListId || !fileContent) {
      return new Response(
        JSON.stringify({ error: 'priceListId and fileContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to processing
    await supabase
      .from('price_lists')
      .update({ status: 'processing' })
      .eq('id', priceListId);

    console.log(`Processing price list: ${priceListId}, file: ${fileName}`);

    const systemPrompt = `Jesteś ekspertem od ekstrakcji danych z cenników produktów (folie samochodowe, PPF, materiały reklamowe itp).

Twoim zadaniem jest wyekstraktowanie wszystkich produktów z podanego cennika.

Dla każdego produktu zwróć obiekt JSON z polami:
- name: pełna nazwa produktu (string, wymagane)
- brand: marka/producent np. "Avery", "3M", "AUTOFACE" (string, opcjonalne)
- description: opis produktu (string, opcjonalne)
- category: kategoria np. "Folie do zmiany koloru", "Folie PPF", "Folie odblaskowe" (string, opcjonalne)
- unit: jednostka miary np. "m²", "mb", "szt" (string, domyślnie "szt")
- default_price: cena netto jako liczba (number, wymagane - jeśli jest zakres cen, weź średnią lub cenę standardową)
- metadata: obiekt z dodatkowymi atrybutami jak:
  - thickness_um: grubość w μm
  - width_cm: szerokość w cm
  - length_m: długość w metrach
  - durability_years: trwałość w latach
  - color: kolor
  - finish: wykończenie (błysk, mat, satin, itp.)
  - prices: obiekt z różnymi cenami jeśli są zróżnicowane (np. {"white": 82.90, "colors": 95.90})

Zwróć TYLKO tablicę JSON bez dodatkowego tekstu. Przykład:
[
  {
    "name": "Avery Supreme Wrapping Film",
    "brand": "Avery Dennison",
    "description": "Najwyższej jakości folia do całkowitego oklejania aut",
    "category": "Folie do zmiany koloru",
    "unit": "m²",
    "default_price": 95.90,
    "metadata": {
      "thickness_um": 80,
      "width_cm": 152,
      "length_m": 25,
      "finish": "błysk/mat/satin",
      "prices": {"white_black": 82.90, "colors": 95.90}
    }
  }
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Wyekstrahuj produkty z tego cennika:\n\n${fileContent}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        await supabase
          .from('price_lists')
          .update({ status: 'failed', error_message: 'Przekroczono limit zapytań AI. Spróbuj ponownie za chwilę.' })
          .eq('id', priceListId);
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        await supabase
          .from('price_lists')
          .update({ status: 'failed', error_message: 'Brak środków na AI. Skontaktuj się z administratorem.' })
          .eq('id', priceListId);
        return new Response(
          JSON.stringify({ error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content.substring(0, 500));

    // Parse JSON from response
    let products: ExtractedProduct[] = [];
    try {
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        products = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      await supabase
        .from('price_lists')
        .update({ 
          status: 'failed', 
          error_message: 'Nie udało się przetworzyć odpowiedzi AI. Sprawdź format cennika.' 
        })
        .eq('id', priceListId);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get price list details for instance_id
    const { data: priceList, error: plError } = await supabase
      .from('price_lists')
      .select('instance_id, is_global')
      .eq('id', priceListId)
      .single();

    if (plError || !priceList) {
      throw new Error('Price list not found');
    }

    // Insert products into products_library
    const productsToInsert = products.map(p => ({
      name: p.name,
      brand: p.brand || null,
      description: p.description || null,
      category: p.category || null,
      unit: p.unit || 'szt',
      default_price: p.default_price || 0,
      metadata: p.metadata || {},
      instance_id: priceList.is_global ? null : priceList.instance_id,
      source: priceList.is_global ? 'global' : 'instance',
      active: true,
    }));

    const { data: insertedProducts, error: insertError } = await supabase
      .from('products_library')
      .insert(productsToInsert)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to insert products: ${insertError.message}`);
    }

    // Update price list status
    await supabase
      .from('price_lists')
      .update({ 
        status: 'completed',
        products_count: insertedProducts?.length || 0,
        extracted_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', priceListId);

    console.log(`Extracted ${insertedProducts?.length || 0} products from price list ${priceListId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        products_count: insertedProducts?.length || 0,
        products: insertedProducts 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-price-list:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "extract-price-list",
      request: req,
      tags: { function: "extract-price-list" },
    });
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
