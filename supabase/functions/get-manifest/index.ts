import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const context = url.searchParams.get("context") || "public"; // "admin" or "public"

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let instanceName = "ArmCar";
    let instanceLogo = "/pwa-192x192.png";
    let themeColor = "#1a1a2e";
    let backgroundColor = "#1a1a2e";

    if (slug) {
      const { data: instance } = await supabase
        .from("instances")
        .select("name, logo_url, primary_color, background_color")
        .eq("slug", slug)
        .single();

      if (instance) {
        instanceName = instance.name;
        if (instance.logo_url) {
          instanceLogo = instance.logo_url;
        }
        if (instance.primary_color) {
          themeColor = instance.primary_color;
        }
        if (instance.background_color) {
          backgroundColor = instance.background_color;
        }
      }
    }

    const isAdmin = context === "admin";
    const appName = isAdmin ? `Admin ${instanceName}` : instanceName;
    const startUrl = isAdmin ? "/admin" : "/";
    const shortName = isAdmin ? `Admin` : instanceName.substring(0, 12);

    const manifest = {
      name: appName,
      short_name: shortName,
      description: isAdmin 
        ? `Panel administracyjny ${instanceName}` 
        : `System rezerwacji ${instanceName}`,
      theme_color: themeColor,
      background_color: backgroundColor,
      display: "standalone",
      orientation: "portrait",
      start_url: startUrl,
      scope: "/",
      icons: [
        {
          src: instanceLogo,
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: instanceLogo,
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: instanceLogo,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    };

    return new Response(JSON.stringify(manifest), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: unknown) {
    console.error("Error generating manifest:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
