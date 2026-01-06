import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, services } = await req.json();
    
    if (!transcript) {
      throw new Error('Brak transkrypcji do przetworzenia');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get current date for reference
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Build services list for the prompt
    const servicesInfo = services && services.length > 0
      ? `Dostępne usługi: ${services.map((s: any) => s.name).join(', ')}`
      : '';

    const systemPrompt = `Jesteś asystentem do parsowania głosowych rezerwacji w myjni samochodowej.
Analizujesz tekst mówiony po polsku i wyciągasz z niego dane rezerwacji.

Dzisiejsza data: ${todayStr}
Jutro: ${tomorrowStr}

${servicesInfo}

Zwróć JSON z polami:
- customerName: imię i nazwisko klienta (string lub null). Jeśli nie podano imienia, zwróć null (NIE domyślne wartości)
- phone: numer telefonu bez spacji, z prefixem +48 jeśli brak (string lub null)
- carModel: model samochodu (string lub null)
- date: data w formacie YYYY-MM-DD (string lub null). "dziś"/"dzisiaj" = ${todayStr}, "jutro" = ${tomorrowStr}
- startTime: godzina rozpoczęcia w formacie HH:MM (string lub null)
- endTime: godzina zakończenia w formacie HH:MM (string lub null)
- serviceName: nazwa usługi najbliższa do dostępnych usług (string lub null)
- shouldConfirm: boolean - true jeśli użytkownik powiedział "zatwierdź", "potwierdź", "dodaj", "zapisz" na końcu wypowiedzi

Przykłady interpretacji:
- "12 do 12.30" -> startTime: "12:00", endTime: "12:30"
- "od 14 do 15" -> startTime: "14:00", endTime: "15:00"
- "godzina 10" -> startTime: "10:00"
- "2 stycznia" -> odpowiednia data w formacie YYYY-MM-DD
- "666610222" lub "666 610 222" -> phone: "+48666610222"
- "...zatwierdź" lub "...potwierdź" -> shouldConfirm: true

WAŻNE: Zwróć TYLKO poprawny JSON bez żadnych dodatkowych komentarzy.`;

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
          { role: 'user', content: `Przeanalizuj tę wypowiedź i wyciągnij dane rezerwacji: "${transcript}"` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Zbyt wiele zapytań, spróbuj ponownie za chwilę' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Limit AI wyczerpany' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('Błąd przetwarzania AI');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Brak odpowiedzi od AI');
    }

    console.log('AI response:', content);

    // Parse JSON from response (handle markdown code blocks)
    let parsed;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Nie udało się sparsować odpowiedzi AI');
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-voice-reservation:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "parse-voice-reservation",
      request: req,
      tags: { function: "parse-voice-reservation" },
    });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
