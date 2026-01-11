import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-e2e-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// HARDCODED E2E INSTANCE ID - NEVER ACCEPT FROM PARAMETERS
const E2E_INSTANCE_ID = "3ba42fcc-3bd4-4330-99dd-bf0a6a4edbf1";
const E2E_INSTANCE_SLUG = "e2e";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security Layer 1: Verify E2E token
    const e2eToken = req.headers.get("x-e2e-token");
    const expectedToken = Deno.env.get("E2E_SEED_TOKEN");
    
    if (!expectedToken) {
      console.error("[SECURITY] E2E_SEED_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "E2E infrastructure not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!e2eToken || e2eToken !== expectedToken) {
      console.error("[SECURITY] Invalid or missing E2E token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Security Layer 2: Verify E2E instance exists with correct slug
    const { data: instance, error: instanceError } = await supabase
      .from("instances")
      .select("id, slug, name")
      .eq("id", E2E_INSTANCE_ID)
      .eq("slug", E2E_INSTANCE_SLUG)
      .single();

    if (instanceError || !instance) {
      console.error("[SECURITY] E2E instance verification failed:", instanceError);
      return new Response(
        JSON.stringify({ 
          error: "E2E instance not found or slug mismatch",
          details: "This endpoint only works for the designated E2E test instance"
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[E2E RESET] Starting reset for instance: ${instance.name} (${instance.slug})`);

    const deletionResults: Record<string, number> = {};

    // Delete in correct order (respecting foreign keys)
    const tablesToClear = [
      // Offers related (most dependent first)
      "offer_reminders",
      "offer_history", 
      "offer_option_items",
      "offer_options",
      "offer_text_blocks",
      "offers",
      
      // Reservations and related
      "sms_logs",
      "sms_verification_codes",
      "notifications",
      "reservations",
      
      // Yard
      "yard_vehicles",
      
      // Customers (after reservations)
      "customer_vehicles",
      "customers",
      
      // Follow-up
      "followup_tasks",
      "followup_events",
      
      // Breaks
      "breaks",
      "closed_days",
    ];

    for (const table of tablesToClear) {
      // Security Layer 3: Always use explicit WHERE clause with hardcoded ID
      const { data: countData } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("instance_id", E2E_INSTANCE_ID);
      
      const recordCount = countData?.length ?? 0;
      
      // Safety check: log what we're about to delete
      console.log(`[E2E RESET] Deleting ${recordCount} records from ${table}`);
      
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("instance_id", E2E_INSTANCE_ID); // ALWAYS explicit instance_id
      
      if (deleteError) {
        console.error(`[E2E RESET] Error deleting from ${table}:`, deleteError);
        // Continue with other tables, don't fail completely
      }
      
      deletionResults[table] = recordCount;
    }

    console.log("[E2E RESET] Completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        instance: {
          id: E2E_INSTANCE_ID,
          slug: E2E_INSTANCE_SLUG,
          name: instance.name
        },
        deletedRecords: deletionResults,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[E2E RESET] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
