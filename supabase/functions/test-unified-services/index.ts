import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-e2e-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Test instance ID (E2E instance)
const TEST_INSTANCE_ID = "3ba42fcc-3bd4-4330-99dd-bf0a6a4edbf1";

// Helper: Generate unique test name
function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify E2E token
    const e2eToken = req.headers.get("x-e2e-token");
    const expectedToken = Deno.env.get("E2E_SEED_TOKEN");
    
    if (!expectedToken || !e2eToken || e2eToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: TestResult[] = [];

    // ========================================================================
    // CATEGORY TESTS
    // ========================================================================

    // USS-001: Create unified_category with service_type 'reservation'
    try {
      const name = uniqueName("TEST_CAT");
      const { data, error } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          slug: name.toLowerCase(),
          category_type: "reservation",
          active: true,
          sort_order: 999
        })
        .select()
        .single();
      
      if (error) throw error;
      if (!data || data.category_type !== "reservation") throw new Error("category_type mismatch");
      
      await supabase.from("unified_categories").delete().eq("id", data.id);
      results.push({ name: "USS-001: Create category type 'reservation'", passed: true });
    } catch (e) {
      results.push({ name: "USS-001: Create category type 'reservation'", passed: false, error: String(e) });
    }

    // USS-002: Create unified_category with service_type 'offer'
    try {
      const name = uniqueName("TEST_CAT");
      const { data, error } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          slug: name.toLowerCase(),
          category_type: "offer",
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data?.category_type !== "offer") throw new Error("category_type mismatch");
      
      await supabase.from("unified_categories").delete().eq("id", data.id);
      results.push({ name: "USS-002: Create category type 'offer'", passed: true });
    } catch (e) {
      results.push({ name: "USS-002: Create category type 'offer'", passed: false, error: String(e) });
    }

    // USS-003: Create unified_category with service_type 'both'
    try {
      const name = uniqueName("TEST_CAT");
      const { data, error } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          slug: name.toLowerCase(),
          category_type: "both",
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data?.category_type !== "both") throw new Error("category_type mismatch");
      
      await supabase.from("unified_categories").delete().eq("id", data.id);
      results.push({ name: "USS-003: Create category type 'both'", passed: true });
    } catch (e) {
      results.push({ name: "USS-003: Create category type 'both'", passed: false, error: String(e) });
    }

    // USS-004: Category requires instance_id
    try {
      const name = uniqueName("TEST_CAT");
      const { error } = await supabase
        .from("unified_categories")
        .insert({
          name,
          slug: name.toLowerCase(),
          category_type: "reservation",
        })
        .select()
        .single();
      
      if (!error) throw new Error("Should have failed without instance_id");
      results.push({ name: "USS-004: Category requires instance_id", passed: true });
    } catch (e) {
      results.push({ name: "USS-004: Category requires instance_id", passed: false, error: String(e) });
    }

    // USS-005: Category slug must be unique per instance
    try {
      const name = uniqueName("TEST_CAT");
      const slug = name.toLowerCase();
      
      const { data: first, error: e1 } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          slug,
          category_type: "reservation"
        })
        .select()
        .single();
      
      if (e1) throw e1;
      
      const { error: duplicateError } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name: name + "_2",
          slug,
          category_type: "reservation"
        })
        .select()
        .single();
      
      await supabase.from("unified_categories").delete().eq("id", first!.id);
      
      if (!duplicateError) throw new Error("Should have failed with duplicate slug");
      results.push({ name: "USS-005: Category slug uniqueness", passed: true });
    } catch (e) {
      results.push({ name: "USS-005: Category slug uniqueness", passed: false, error: String(e) });
    }

    // USS-006: Update category name
    try {
      const name = uniqueName("TEST_CAT");
      const newName = uniqueName("TEST_CAT_UPD");
      
      const { data: created } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          slug: name.toLowerCase(),
          category_type: "reservation"
        })
        .select()
        .single();
      
      const { data: updated, error } = await supabase
        .from("unified_categories")
        .update({ name: newName })
        .eq("id", created!.id)
        .select()
        .single();
      
      if (error) throw error;
      if (updated?.name !== newName) throw new Error("name not updated");
      
      await supabase.from("unified_categories").delete().eq("id", created!.id);
      results.push({ name: "USS-006: Update category name", passed: true });
    } catch (e) {
      results.push({ name: "USS-006: Update category name", passed: false, error: String(e) });
    }

    // USS-007: Soft delete category (set active = false)
    try {
      const name = uniqueName("TEST_CAT");
      
      const { data: created } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          slug: name.toLowerCase(),
          category_type: "reservation",
          active: true
        })
        .select()
        .single();
      
      const { data: deactivated, error } = await supabase
        .from("unified_categories")
        .update({ active: false })
        .eq("id", created!.id)
        .select()
        .single();
      
      if (error) throw error;
      if (deactivated?.active !== false) throw new Error("active not set to false");
      
      await supabase.from("unified_categories").delete().eq("id", created!.id);
      results.push({ name: "USS-007: Soft delete category", passed: true });
    } catch (e) {
      results.push({ name: "USS-007: Soft delete category", passed: false, error: String(e) });
    }

    // ========================================================================
    // SERVICE TESTS
    // ========================================================================

    // USS-010: Create unified_service with service_type 'reservation'
    try {
      const name = uniqueName("TEST_SVC");
      const { data, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TST",
          service_type: "reservation",
          duration_minutes: 60,
          price_from: 100,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data?.service_type !== "reservation") throw new Error("service_type mismatch");
      if (data?.duration_minutes !== 60) throw new Error("duration_minutes mismatch");
      
      await supabase.from("unified_services").delete().eq("id", data.id);
      results.push({ name: "USS-010: Create service type 'reservation'", passed: true });
    } catch (e) {
      results.push({ name: "USS-010: Create service type 'reservation'", passed: false, error: String(e) });
    }

    // USS-011: Create unified_service with service_type 'offer'
    try {
      const name = uniqueName("TEST_SVC");
      const { data, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TSO",
          service_type: "offer",
          price_from: 500,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data?.service_type !== "offer") throw new Error("service_type mismatch");
      
      await supabase.from("unified_services").delete().eq("id", data.id);
      results.push({ name: "USS-011: Create service type 'offer'", passed: true });
    } catch (e) {
      results.push({ name: "USS-011: Create service type 'offer'", passed: false, error: String(e) });
    }

    // USS-012: Create unified_service with service_type 'both'
    try {
      const name = uniqueName("TEST_SVC");
      const { data, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TSB",
          service_type: "both",
          duration_minutes: 45,
          price_from: 150,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data?.service_type !== "both") throw new Error("service_type mismatch");
      
      await supabase.from("unified_services").delete().eq("id", data.id);
      results.push({ name: "USS-012: Create service type 'both'", passed: true });
    } catch (e) {
      results.push({ name: "USS-012: Create service type 'both'", passed: false, error: String(e) });
    }

    // USS-013: Service with size-based pricing
    try {
      const name = uniqueName("TEST_SVC");
      const { data, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TSZ",
          service_type: "reservation",
          requires_size: true,
          duration_small: 30,
          duration_medium: 45,
          duration_large: 60,
          price_small: 50,
          price_medium: 75,
          price_large: 100,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (!data?.requires_size) throw new Error("requires_size not set");
      if (data?.price_small !== 50) throw new Error("price_small mismatch");
      if (data?.price_medium !== 75) throw new Error("price_medium mismatch");
      if (data?.price_large !== 100) throw new Error("price_large mismatch");
      
      await supabase.from("unified_services").delete().eq("id", data.id);
      results.push({ name: "USS-013: Size-based pricing", passed: true });
    } catch (e) {
      results.push({ name: "USS-013: Size-based pricing", passed: false, error: String(e) });
    }

    // USS-014: Service with category reference
    try {
      const catName = uniqueName("TEST_CAT");
      const svcName = uniqueName("TEST_SVC");
      
      const { data: category } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name: catName,
          slug: catName.toLowerCase(),
          category_type: "reservation"
        })
        .select()
        .single();
      
      const { data: service, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          category_id: category!.id,
          name: svcName,
          short_name: "TCS",
          service_type: "reservation",
          price_from: 100,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (service?.category_id !== category!.id) throw new Error("category_id mismatch");
      
      await supabase.from("unified_services").delete().eq("id", service!.id);
      await supabase.from("unified_categories").delete().eq("id", category!.id);
      results.push({ name: "USS-014: Service with category reference", passed: true });
    } catch (e) {
      results.push({ name: "USS-014: Service with category reference", passed: false, error: String(e) });
    }

    // USS-015: Service requires instance_id
    try {
      const name = uniqueName("TEST_SVC");
      const { error } = await supabase
        .from("unified_services")
        .insert({
          name,
          short_name: "TER",
          service_type: "reservation",
        })
        .select()
        .single();
      
      if (!error) throw new Error("Should have failed without instance_id");
      results.push({ name: "USS-015: Service requires instance_id", passed: true });
    } catch (e) {
      results.push({ name: "USS-015: Service requires instance_id", passed: false, error: String(e) });
    }

    // USS-016: Update service price
    try {
      const name = uniqueName("TEST_SVC");
      
      const { data: created } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TUP",
          service_type: "reservation",
          price_from: 100,
          active: true
        })
        .select()
        .single();
      
      const { data: updated, error } = await supabase
        .from("unified_services")
        .update({ price_from: 150 })
        .eq("id", created!.id)
        .select()
        .single();
      
      if (error) throw error;
      if (updated?.price_from !== 150) throw new Error("price_from not updated");
      
      await supabase.from("unified_services").delete().eq("id", created!.id);
      results.push({ name: "USS-016: Update service price", passed: true });
    } catch (e) {
      results.push({ name: "USS-016: Update service price", passed: false, error: String(e) });
    }

    // USS-017: Update service duration
    try {
      const name = uniqueName("TEST_SVC");
      
      const { data: created } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TUD",
          service_type: "reservation",
          duration_minutes: 30,
          price_from: 50,
          active: true
        })
        .select()
        .single();
      
      const { data: updated, error } = await supabase
        .from("unified_services")
        .update({ duration_minutes: 45 })
        .eq("id", created!.id)
        .select()
        .single();
      
      if (error) throw error;
      if (updated?.duration_minutes !== 45) throw new Error("duration_minutes not updated");
      
      await supabase.from("unified_services").delete().eq("id", created!.id);
      results.push({ name: "USS-017: Update service duration", passed: true });
    } catch (e) {
      results.push({ name: "USS-017: Update service duration", passed: false, error: String(e) });
    }

    // USS-018: Soft delete service (set active = false)
    try {
      const name = uniqueName("TEST_SVC");
      
      const { data: created } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TSD",
          service_type: "reservation",
          price_from: 100,
          active: true
        })
        .select()
        .single();
      
      const { data: deactivated, error } = await supabase
        .from("unified_services")
        .update({ active: false })
        .eq("id", created!.id)
        .select()
        .single();
      
      if (error) throw error;
      if (deactivated?.active !== false) throw new Error("active not set to false");
      
      await supabase.from("unified_services").delete().eq("id", created!.id);
      results.push({ name: "USS-018: Soft delete service", passed: true });
    } catch (e) {
      results.push({ name: "USS-018: Soft delete service", passed: false, error: String(e) });
    }

    // USS-019: Service short_name can be null
    try {
      const name = uniqueName("TEST_SVC");
      const { data, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: null,
          service_type: "offer",
          price_from: 200,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data?.short_name !== null) throw new Error("short_name should be null");
      
      await supabase.from("unified_services").delete().eq("id", data.id);
      results.push({ name: "USS-019: Service short_name can be null", passed: true });
    } catch (e) {
      results.push({ name: "USS-019: Service short_name can be null", passed: false, error: String(e) });
    }

    // ========================================================================
    // QUERY TESTS
    // ========================================================================

    // USS-020: Filter services by service_type 'reservation'
    try {
      const prefix = uniqueName("TEST_SVC");
      
      await supabase.from("unified_services").insert([
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_res`, short_name: "R1", service_type: "reservation", price_from: 100, active: true },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_off`, short_name: "O1", service_type: "offer", price_from: 200, active: true },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_bot`, short_name: "B1", service_type: "both", price_from: 150, active: true },
      ]);
      
      const { data, error } = await supabase
        .from("unified_services")
        .select("*")
        .eq("instance_id", TEST_INSTANCE_ID)
        .ilike("name", `${prefix}%`)
        .in("service_type", ["reservation", "both"]);
      
      await supabase.from("unified_services").delete().eq("instance_id", TEST_INSTANCE_ID).ilike("name", `${prefix}%`);
      
      if (error) throw error;
      if (data?.length !== 2) throw new Error(`Expected 2, got ${data?.length}`);
      results.push({ name: "USS-020: Filter by reservation type", passed: true });
    } catch (e) {
      results.push({ name: "USS-020: Filter by reservation type", passed: false, error: String(e) });
    }

    // USS-021: Filter services by service_type 'offer'
    try {
      const prefix = uniqueName("TEST_SVC");
      
      await supabase.from("unified_services").insert([
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_res`, short_name: "R2", service_type: "reservation", price_from: 100, active: true },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_off`, short_name: "O2", service_type: "offer", price_from: 200, active: true },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_bot`, short_name: "B2", service_type: "both", price_from: 150, active: true },
      ]);
      
      const { data, error } = await supabase
        .from("unified_services")
        .select("*")
        .eq("instance_id", TEST_INSTANCE_ID)
        .ilike("name", `${prefix}%`)
        .in("service_type", ["offer", "both"]);
      
      await supabase.from("unified_services").delete().eq("instance_id", TEST_INSTANCE_ID).ilike("name", `${prefix}%`);
      
      if (error) throw error;
      if (data?.length !== 2) throw new Error(`Expected 2, got ${data?.length}`);
      results.push({ name: "USS-021: Filter by offer type", passed: true });
    } catch (e) {
      results.push({ name: "USS-021: Filter by offer type", passed: false, error: String(e) });
    }

    // USS-022: Query services with category join
    try {
      const catName = uniqueName("TEST_CAT");
      const svcName = uniqueName("TEST_SVC");
      
      const { data: category } = await supabase
        .from("unified_categories")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name: catName,
          slug: catName.toLowerCase(),
          category_type: "reservation"
        })
        .select()
        .single();
      
      const { data: service } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          category_id: category!.id,
          name: svcName,
          short_name: "JOI",
          service_type: "reservation",
          price_from: 100,
          active: true
        })
        .select()
        .single();
      
      const { data: joined, error } = await supabase
        .from("unified_services")
        .select(`*, category:unified_categories(id, name, category_type)`)
        .eq("id", service!.id)
        .single();
      
      await supabase.from("unified_services").delete().eq("id", service!.id);
      await supabase.from("unified_categories").delete().eq("id", category!.id);
      
      if (error) throw error;
      if (!joined?.category) throw new Error("category not joined");
      if (joined.category.name !== catName) throw new Error("category name mismatch");
      results.push({ name: "USS-022: Query with category join", passed: true });
    } catch (e) {
      results.push({ name: "USS-022: Query with category join", passed: false, error: String(e) });
    }

    // USS-023: Filter only active services
    try {
      const prefix = uniqueName("TEST_SVC");
      
      await supabase.from("unified_services").insert([
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_active1`, short_name: "A1", service_type: "reservation", price_from: 100, active: true },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_inactive`, short_name: "I1", service_type: "reservation", price_from: 100, active: false },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_active2`, short_name: "A2", service_type: "reservation", price_from: 150, active: true },
      ]);
      
      const { data, error } = await supabase
        .from("unified_services")
        .select("*")
        .eq("instance_id", TEST_INSTANCE_ID)
        .ilike("name", `${prefix}%`)
        .eq("active", true);
      
      await supabase.from("unified_services").delete().eq("instance_id", TEST_INSTANCE_ID).ilike("name", `${prefix}%`);
      
      if (error) throw error;
      if (data?.length !== 2) throw new Error(`Expected 2 active, got ${data?.length}`);
      results.push({ name: "USS-023: Filter active services", passed: true });
    } catch (e) {
      results.push({ name: "USS-023: Filter active services", passed: false, error: String(e) });
    }

    // USS-024: Order services by sort_order
    try {
      const prefix = uniqueName("TEST_SVC");
      
      await supabase.from("unified_services").insert([
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_third`, short_name: "T3", service_type: "reservation", price_from: 100, sort_order: 3, active: true },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_first`, short_name: "T1", service_type: "reservation", price_from: 100, sort_order: 1, active: true },
        { instance_id: TEST_INSTANCE_ID, name: `${prefix}_second`, short_name: "T2", service_type: "reservation", price_from: 100, sort_order: 2, active: true },
      ]);
      
      const { data, error } = await supabase
        .from("unified_services")
        .select("*")
        .eq("instance_id", TEST_INSTANCE_ID)
        .ilike("name", `${prefix}%`)
        .order("sort_order", { ascending: true });
      
      await supabase.from("unified_services").delete().eq("instance_id", TEST_INSTANCE_ID).ilike("name", `${prefix}%`);
      
      if (error) throw error;
      if (data?.[0]?.name !== `${prefix}_first`) throw new Error("sort_order not working");
      if (data?.[2]?.name !== `${prefix}_third`) throw new Error("sort_order not working");
      results.push({ name: "USS-024: Order by sort_order", passed: true });
    } catch (e) {
      results.push({ name: "USS-024: Order by sort_order", passed: false, error: String(e) });
    }

    // ========================================================================
    // EDGE CASE TESTS
    // ========================================================================

    // USS-030: Service with all optional fields
    try {
      const name = uniqueName("TEST_SVC");
      const { data, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "FUL",
          description: "Full description with all fields",
          service_type: "both",
          requires_size: true,
          duration_minutes: 60,
          duration_small: 45,
          duration_medium: 60,
          duration_large: 90,
          price_from: 100,
          price_small: 80,
          price_medium: 100,
          price_large: 150,
          is_popular: true,
          sort_order: 5,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data?.description !== "Full description with all fields") throw new Error("description mismatch");
      if (data?.is_popular !== true) throw new Error("is_popular mismatch");
      
      await supabase.from("unified_services").delete().eq("id", data.id);
      results.push({ name: "USS-030: Service with all optional fields", passed: true });
    } catch (e) {
      results.push({ name: "USS-030: Service with all optional fields", passed: false, error: String(e) });
    }

    // USS-031: Timestamps are auto-generated
    try {
      const name = uniqueName("TEST_SVC");
      const beforeInsert = new Date();
      
      const { data, error } = await supabase
        .from("unified_services")
        .insert({
          instance_id: TEST_INSTANCE_ID,
          name,
          short_name: "TIM",
          service_type: "reservation",
          price_from: 100,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      if (!data?.created_at) throw new Error("created_at not set");
      if (!data?.updated_at) throw new Error("updated_at not set");
      
      const createdAt = new Date(data.created_at);
      if (createdAt < beforeInsert) throw new Error("created_at is in the past");
      
      await supabase.from("unified_services").delete().eq("id", data.id);
      results.push({ name: "USS-031: Timestamps auto-generated", passed: true });
    } catch (e) {
      results.push({ name: "USS-031: Timestamps auto-generated", passed: false, error: String(e) });
    }

    // Summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return new Response(
      JSON.stringify({
        summary: {
          total: results.length,
          passed,
          failed,
          status: failed === 0 ? "PASSED" : "FAILED"
        },
        results
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[TEST-UNIFIED-SERVICES] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
