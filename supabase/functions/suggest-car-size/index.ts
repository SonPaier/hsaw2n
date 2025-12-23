import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { carModel } = await req.json();
    
    if (!carModel || carModel.trim().length < 2) {
      return new Response(
        JSON.stringify({ size: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a car size classifier. Based on the car model name, classify it into one of three categories:
- "small" - compact cars, city cars, small hatchbacks (e.g., Fiat 500, VW Polo, Toyota Yaris, Smart, Mini Cooper)
- "medium" - sedans, standard SUVs, wagons (e.g., VW Golf, Toyota Corolla, BMW 3, Audi A4, Honda Civic, Mazda 6)
- "large" - large SUVs, luxury sedans, vans, pickups (e.g., BMW X5, Audi Q7, Mercedes GLE, Toyota Land Cruiser, Range Rover, VW Transporter)

Respond with ONLY the size word: small, medium, or large. Nothing else.`
          },
          {
            role: "user",
            content: carModel
          }
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later.", size: null }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required.", size: null }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status);
      return new Response(
        JSON.stringify({ size: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawSize = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    
    // Validate the response
    let size: "small" | "medium" | "large" | null = null;
    if (rawSize === "small" || rawSize === "medium" || rawSize === "large") {
      size = rawSize;
    }

    return new Response(
      JSON.stringify({ size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in suggest-car-size:", error);
    return new Response(
      JSON.stringify({ size: null, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
