import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Support two auth methods: service_role secret OR user JWT
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    
    // If token matches service role key, allow (admin-only CLI usage)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let isAuthorized = false;

    if (token === serviceRoleKey) {
      isAuthorized = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      // Try user auth
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (user && !userError) {
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role, instance_id")
          .eq("user_id", user.id);
        isAuthorized = roles?.some((r) => r.role === "super_admin" || r.role === "admin") || false;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { slug } = await req.json();
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get instance
    const { data: instance, error: instErr } = await supabaseAdmin
      .from("instances")
      .select("*")
      .eq("slug", slug)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const instanceId = instance.id;

    // Verify access
    const isInstanceAdmin = roles?.some(
      (r) => r.role === "admin" && r.instance_id === instanceId
    );
    if (!isSuperAdmin && !isInstanceAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // All tables that have instance_id
    const instanceTables = [
      "reservations",
      "customers",
      "customer_vehicles",
      "customer_reminders",
      "services",
      "unified_services",
      "unified_categories",
      "stations",
      "breaks",
      "closed_days",
      "employees",
      "employee_breaks",
      "employee_days_off",
      "employee_edit_logs",
      "employee_permissions",
      "time_entries",
      "notifications",
      "offers",
      "offer_reminders",
      "offer_product_categories",
      "offer_scopes",
      "offer_variants",
      "halls",
      "instance_features",
      "instance_subscriptions",
      "followup_services",
      "followup_events",
      "followup_tasks",
      "reservation_changes",
      "reservation_photos",
      "sms_logs",
      "login_attempts",
      "profiles",
      "user_roles",
      "price_lists",
      "vehicle_protocols",
      "protocol_damage_points",
      "training_types",
      "trainings",
      "push_subscriptions",
      "workers_settings",
      "sales_customers",
      "sales_products",
      "sales_orders",
      "sales_order_items",
      "reminder_templates",
      "text_blocks_library",
    ];

    const dump: Record<string, unknown> = {
      _meta: {
        exported_at: new Date().toISOString(),
        instance_slug: slug,
        instance_id: instanceId,
      },
      instance: instance,
    };

    // Fetch each table in parallel
    const results = await Promise.allSettled(
      instanceTables.map(async (table) => {
        try {
          // Try instance_id filter first
          const { data, error } = await supabaseAdmin
            .from(table)
            .select("*")
            .eq("instance_id", instanceId)
            .limit(10000);

          if (error) {
            // Table might not exist or no instance_id column
            return { table, data: null, error: error.message };
          }
          return { table, data, error: null };
        } catch (e) {
          return { table, data: null, error: String(e) };
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { table, data, error } = result.value;
        if (data && data.length > 0) {
          dump[table] = { count: data.length, rows: data };
        } else if (error) {
          dump[table] = { count: 0, error };
        } else {
          dump[table] = { count: 0, rows: [] };
        }
      }
    }

    // Also fetch related offer data (options, items, scopes products, etc.)
    const offerIds =
      (dump.offers as any)?.rows?.map((o: any) => o.id) || [];

    if (offerIds.length > 0) {
      const offerRelated = [
        "offer_options",
        "offer_option_items",
        "offer_text_blocks",
        "offer_history",
        "offer_views",
      ];

      const offerResults = await Promise.allSettled(
        offerRelated.map(async (table) => {
          const { data, error } = await supabaseAdmin
            .from(table)
            .select("*")
            .in("offer_id", offerIds)
            .limit(10000);
          return { table, data, error: error?.message };
        })
      );

      for (const result of offerResults) {
        if (result.status === "fulfilled") {
          const { table, data } = result.value;
          dump[table] = { count: data?.length || 0, rows: data || [] };
        }
      }
    }

    // Offer scope related data
    const scopeIds =
      (dump.offer_scopes as any)?.rows?.map((s: any) => s.id) || [];
    if (scopeIds.length > 0) {
      const scopeRelated = [
        "offer_scope_products",
        "offer_scope_extras",
        "offer_scope_variants",
        "offer_scope_variant_products",
      ];

      const scopeResults = await Promise.allSettled(
        scopeRelated.map(async (table) => {
          const { data, error } = await supabaseAdmin
            .from(table)
            .select("*")
            .in("scope_id", scopeIds)
            .limit(10000);
          return { table, data, error: error?.message };
        })
      );

      for (const result of scopeResults) {
        if (result.status === "fulfilled") {
          const { table, data } = result.value;
          dump[table] = { count: data?.length || 0, rows: data || [] };
        }
      }
    }

    // Scope extras -> extra products
    const extraIds =
      (dump.offer_scope_extras as any)?.rows?.map((e: any) => e.id) || [];
    if (extraIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("offer_scope_extra_products")
        .select("*")
        .in("extra_id", extraIds)
        .limit(10000);
      dump["offer_scope_extra_products"] = {
        count: data?.length || 0,
        rows: data || [],
      };
    }

    return new Response(JSON.stringify(dump, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dump-${slug}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
