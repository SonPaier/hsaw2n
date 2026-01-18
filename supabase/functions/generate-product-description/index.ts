import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, brand, category } = await req.json();
    
    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'Product name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for the AI
    const brandInfo = brand ? ` marki ${brand}` : '';
    const categoryInfo = category ? ` z kategorii ${category}` : '';
    
    const systemPrompt = `Jesteś ekspertem od detailingu samochodowego, folii ochronnych PPF, powłok ceramicznych i produktów do pielęgnacji aut.
Twoim zadaniem jest napisanie profesjonalnego, marketingowego opisu produktu/usługi dla oferty handlowej.

Zasady:
- Napisz 4-5 zdań po polsku
- Skup się na korzyściach dla klienta
- Używaj profesjonalnego, ale przystępnego języka
- Podkreśl jakość, trwałość i ochronę
- Jeśli to znany produkt (np. folia XPEL, STEK, Gyeon), uwzględnij jego unikalne cechy
- NIE używaj emoji ani list punktowanych
- Pisz w sposób przekonujący ale nie przesadny`;

    const userPrompt = `Napisz opis produktu/usługi: "${productName}"${brandInfo}${categoryInfo}.

Jeśli to znany produkt detailingowy lub folia PPF/powłoka ceramiczna, wykorzystaj swoją wiedzę o jego właściwościach.`;

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
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Zbyt wiele zapytań. Spróbuj ponownie za chwilę.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Brak środków na koncie AI. Doładuj kredyty w ustawieniach workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Błąd generowania opisu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const generatedDescription = data.choices?.[0]?.message?.content?.trim() || '';

    if (!generatedDescription) {
      return new Response(
        JSON.stringify({ error: 'Nie udało się wygenerować opisu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ description: generatedDescription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating description:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
