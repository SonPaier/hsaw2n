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

    // Category-specific hints for AI
    const categoryHints: Record<string, string> = {
      'Folia ochronna': 'Podkreśl ochronę przed odpryskami i zarysowaniami. Wspomnij o grubości w µm (np. 200µm) i technologii self-healing jako korzyści. Zaakcentuj trwałość i gwarancję.',
      'Powłoki': 'Skup się na efekcie wizualnym (głęboki połysk) i łatwości mycia. Wspomnij o twardości (np. 9H) i hydrofobowości jako gwarancji trwałego efektu.',
      'Powłoki lakieru': 'Opisz ochronę lakieru i intensywność połysku. Wspomnij o twardości ceramicznej i hydrofobowości. Podkreśl łatwość utrzymania czystości.',
      'Powłoki szyby': 'Skup się na bezpieczeństwie jazdy i widoczności. Opisz efekt spływania wody i trwałość ochrony.',
      'Powłoki opony': 'Opisz efekt wizualny (mat/połysk satin) i ochronę przed UV. Podkreśl trwałość i głębię czerni.',
      'Korekta lakieru': 'Opisz efekt końcowy (lustrzany połysk, głębia koloru). Wspomnij o usunięciu zarysowań i hologramów. Podkreśl profesjonalny rezultat.',
      'Detailing': 'Skup się na efekcie końcowym i odświeżeniu wyglądu. Opisz profesjonalne podejście i dbałość o detale.',
      'Woski': 'Podkreśl głębię koloru i naturalny połysk. Wspomnij o ochronie lakieru i zawartości wosku carnaubskiego.',
      'Felgi': 'Opisz ochronę przed brudem hamulcowym i łatwość czyszczenia. Wspomnij o odporności na temperaturę.',
      'Szyby': 'Skup się na poprawie widoczności i bezpieczeństwie. Opisz efekt hydrofobowy i łatwość usuwania zabrudzeń.',
    };

    // Build context for the AI
    const brandInfo = brand ? ` marki ${brand}` : '';
    const categoryInfo = category ? ` z kategorii ${category}` : '';
    const hints = category ? categoryHints[category] : null;
    
    const systemPrompt = `Jesteś ekspertem od detailingu samochodowego, folii ochronnych PPF, powłok ceramicznych i produktów do pielęgnacji aut.
Twoim zadaniem jest napisanie profesjonalnego opisu produktu/usługi dla oferty handlowej.

Zasady:
- Napisz 2-3 zdania po polsku w stylu oferty handlowej
- Zacznij od korzyści dla klienta (ochrona, efekt wizualny, trwałość)
- Wpleć 1-2 kluczowe dane techniczne naturalnie w tekst (grubość folii ZAWSZE w mikronach µm, twardość w H, trwałość w latach)
- Używaj profesjonalnego ale przekonującego języka
- NIE używaj emoji ani list punktowanych
- Bądź konkretny ale nie przesadnie techniczny${hints ? `

WSKAZÓWKI DLA TEJ KATEGORII:
${hints}` : ''}`;

    const userPrompt = `Napisz profesjonalny opis produktu: "${productName}"${brandInfo}${categoryInfo}.

Skup się na korzyściach dla klienta, wplatając naturalnie 1-2 kluczowe parametry techniczne. Jeśli to znana marka (XPEL, STEK, Gyeon, Sonax itp.), wykorzystaj swoją wiedzę o produkcie.`;

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
