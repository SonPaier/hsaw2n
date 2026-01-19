import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanTranscriptRequest {
  type: 'clean_transcript';
  transcript: string;
}

interface AnalyzeImageRequest {
  type: 'analyze_image';
  imageUrl: string;
}

type RequestBody = CleanTranscriptRequest | AnalyzeImageRequest;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: RequestBody = await req.json();

    if (body.type === 'clean_transcript') {
      // Clean and format voice transcript
      const systemPrompt = `Jesteś asystentem do przetwarzania nagrań głosowych dotyczących uszkodzeń pojazdów.

Twoje zadanie:
1. Usuń wszystkie wulgaryzmy, przekleństwa i słowa-wypełniacze (yyy, eee, no, kurde, cholera, itp.)
2. Wyodrębnij tylko informacje dotyczące uszkodzenia:
   - Typ uszkodzenia (rysa, wgniecenie, odprysk, pęknięcie, itp.)
   - Lokalizacja (zderzak, maska, drzwi, błotnik, dach, itp.)
   - Rozmiar/wymiary (jeśli podane)
   - Głębokość/intensywność (jeśli podana)
3. Sformatuj tekst w czytelny, profesjonalny sposób

Zwróć TYLKO sformatowany opis uszkodzenia, bez żadnych dodatkowych komentarzy.
Jeśli nie ma żadnych informacji o uszkodzeniu, zwróć pusty string.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: body.transcript },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Przekroczono limit zapytań, spróbuj ponownie później." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Wymagana płatność, doładuj kredyty." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const cleanedText = data.choices?.[0]?.message?.content?.trim() || '';

      return new Response(JSON.stringify({ result: cleanedText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (body.type === 'analyze_image') {
      // Analyze image for damage detection
      const systemPrompt = `Jesteś ekspertem od oceny uszkodzeń pojazdów.

Przeanalizuj zdjęcie i zidentyfikuj widoczne uszkodzenia.

Dla każdego uszkodzenia określ:
1. Typ: rysa, wgniecenie, odprysk, pęknięcie, zarysowanie, uszkodzenie lakieru, korozja, inne
2. Lokalizacja na elemencie (góra, dół, środek, lewa strona, prawa strona)
3. Przybliżony rozmiar (mały <5cm, średni 5-15cm, duży >15cm)
4. Intensywność (lekkie, średnie, głębokie)

Zwróć krótki, profesjonalny opis uszkodzenia w języku polskim.
Jeśli nie widzisz żadnych uszkodzeń, napisz "Brak widocznych uszkodzeń".
Nie dodawaj żadnych wstępów ani podsumowań.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: [
                { type: "text", text: "Przeanalizuj to zdjęcie pod kątem uszkodzeń pojazdu:" },
                { type: "image_url", image_url: { url: body.imageUrl } }
              ]
            },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Przekroczono limit zapytań, spróbuj ponownie później." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Wymagana płatność, doładuj kredyty." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content?.trim() || 'Nie udało się przeanalizować zdjęcia.';

      // Try to detect damage type from analysis
      let suggestedType = 'custom';
      const analysisLower = analysis.toLowerCase();
      if (analysisLower.includes('rysa') || analysisLower.includes('zarysowanie')) {
        suggestedType = 'scratch';
      } else if (analysisLower.includes('wgniecenie') || analysisLower.includes('wgięcie')) {
        suggestedType = 'dent';
      } else if (analysisLower.includes('odprysk') || analysisLower.includes('odprysek')) {
        suggestedType = 'chip';
      } else if (analysisLower.includes('uszkodzenie') || analysisLower.includes('pęknięcie') || analysisLower.includes('złamanie')) {
        suggestedType = 'damage';
      }

      return new Response(JSON.stringify({ 
        result: analysis,
        suggestedType,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-damage error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
