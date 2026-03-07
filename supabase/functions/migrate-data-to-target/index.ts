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
    // Auth: only service_role or super_admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let isAuthorized = token === serviceRoleKey;
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          serviceRoleKey
        );
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        isAuthorized = roles?.some((r) => r.role === "super_admin") || false;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const migrateAll = body.all === true;
    const slug = body.slug || "armcar";
    const dryRun = body.dry_run || false;

    const source = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const targetUrl = Deno.env.get("TARGET_SUPABASE_URL")!;
    const targetKey = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY")!;
    const target = createClient(targetUrl, targetKey);

    const log: string[] = [];
    const errors: string[] = [];

    // ---- Tables with composite PK (no "id" column on target) ----
    const compositeKeyTables: Record<string, string> = {
      instance_features: "instance_id,feature_key",
      workers_settings: "instance_id",
      station_employees: "station_id,employee_id",
    };
    // Tables where target has no "id" column — strip it before insert
    const stripIdTables = new Set(["instance_features", "workers_settings"]);

    // ---- Helper: read all rows from a table (paginated) ----
    const readAll = async (tableName: string, filter?: { col: string; val: string }, batchSize = 500): Promise<any[]> => {
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let q = source.from(tableName).select("*");
        if (filter) q = q.eq(filter.col, filter.val);
        q = q.range(offset, offset + batchSize - 1);
        const { data, error } = await q;
        if (error) { errors.push(`${tableName}: read error - ${error.message}`); return allData; }
        if (!data || data.length === 0) { hasMore = false; } else {
          allData = allData.concat(data);
          offset += batchSize;
          if (data.length < batchSize) hasMore = false;
        }
      }
      return allData;
    };

    // ---- Helper: read rows filtered by IN ----
    const readByIds = async (tableName: string, col: string, ids: string[]): Promise<any[]> => {
      if (!ids.length) return [];
      let allData: any[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { data, error } = await source.from(tableName).select("*").in(col, chunk).limit(10000);
        if (error) errors.push(`${tableName}: read error - ${error.message}`);
        else if (data) allData = allData.concat(data);
      }
      return allData;
    };

    // ---- Helper: write rows to target ----
    const writeToTarget = async (tableName: string, rows: any[], batchSize = 500): Promise<number> => {
      if (!rows.length) { log.push(`${tableName}: 0 rows (skipped)`); return 0; }
      if (dryRun) { log.push(`${tableName}: ${rows.length} rows (dry run)`); return rows.length; }
      
      const conflictKey = compositeKeyTables[tableName] || "id";
      
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        let batch = rows.slice(i, i + batchSize);
        // Strip "id" column for tables that don't have it on target
        if (stripIdTables.has(tableName)) {
          batch = batch.map((row: any) => { const { id, ...rest } = row; return rest; });
        }
        const { error } = await target.from(tableName).upsert(batch, { onConflict: conflictKey, ignoreDuplicates: true });
        if (error) errors.push(`${tableName}: insert error (batch ${Math.floor(i/batchSize)}) - ${error.message}`);
        else inserted += batch.length;
      }
      log.push(`${tableName}: ${inserted}/${rows.length} rows migrated`);
      return inserted;
    };

    // ---- Helper: migrate a full table (no filter) ----
    const migrateFullTable = async (tableName: string) => {
      const rows = await readAll(tableName);
      await writeToTarget(tableName, rows);
    };

    // ---- Helper: migrate table filtered by instance_id ----
    const migrateByInstance = async (tableName: string, instanceId: string) => {
      const rows = await readAll(tableName, { col: "instance_id", val: instanceId });
      await writeToTarget(tableName, rows);
    };

    // ---- Helper: migrate related by IDs ----
    const migrateByIds = async (tableName: string, col: string, ids: string[]) => {
      const rows = await readByIds(tableName, col, ids);
      await writeToTarget(tableName, rows);
    };

    // ========== STEP 0: Global tables ==========
    for (const t of ["car_models", "subscription_plans"]) {
      await migrateFullTable(t);
    }

    // Global offer_scopes
    const globalScopes = await readAll("offer_scopes");
    const globalScopeRows = globalScopes.filter((s: any) => s.source === "global" && !s.instance_id);
    await writeToTarget("offer_scopes", globalScopeRows);

    // ========== Get instances to migrate ==========
    let instances: any[] = [];
    if (migrateAll) {
      instances = await readAll("instances");
      log.push(`=== Migrating ALL ${instances.length} instances ===`);
    } else {
      const { data: inst, error: instErr } = await source
        .from("instances").select("*").eq("slug", slug).single();
      if (instErr || !inst) {
        return new Response(
          JSON.stringify({ error: "Instance not found", details: instErr }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      instances = [inst];
    }

    // ========== Migrate each instance ==========
    for (const instance of instances) {
      const instanceId = instance.id;
      log.push(`--- Instance: ${instance.slug} (${instanceId}) ---`);

      // 1. Instance itself
      await writeToTarget("instances", [instance]);

      // 2. Instance subscription (MUST be before stations to set station_limit)
      const subs = await readAll("instance_subscriptions", { col: "instance_id", val: instanceId });
      if (subs.length > 0) {
        // Temporarily set high station_limit so stations can be inserted
        const subsWithHighLimit = subs.map((s: any) => ({ ...s, station_limit: 999 }));
        await writeToTarget("instance_subscriptions", subsWithHighLimit);
      }

      // 3. Profiles & user_roles (MUST be before login_attempts)
      await migrateByInstance("profiles", instanceId);
      await migrateByInstance("user_roles", instanceId);

      // 4. Level-1 tables (instance_id filter) - includes stations
      const l1Tables = [
        "stations", "service_categories", "employees", "customers",
        "unified_categories", "reminder_templates", "offer_variants",
        "offer_product_categories", "followup_services", "training_types",
        "halls", "workers_settings", "sales_products",
      ];
      for (const t of l1Tables) await migrateByInstance(t, instanceId);

      // 5. Level-2 tables (depend on L1)
      const l2Tables = [
        "services", "customer_vehicles", "closed_days", "breaks",
        "notifications", "employee_breaks", "employee_days_off",
        "employee_edit_logs", "employee_permissions", "instance_features",
        "unified_services", "sms_message_settings", "login_attempts",
        "push_subscriptions", "price_lists", "products_library", "text_blocks_library",
      ];
      for (const t of l2Tables) await migrateByInstance(t, instanceId);

      // 6. Reservations (depends on stations, services)
      await migrateByInstance("reservations", instanceId);

      // 7. Tables depending on reservations
      // reservation_changes: filter out rows with null new_value
      const resChanges = await readAll("reservation_changes", { col: "instance_id", val: instanceId });
      const validChanges = resChanges.filter((r: any) => r.new_value !== null);
      if (validChanges.length < resChanges.length) {
        log.push(`reservation_changes: filtered out ${resChanges.length - validChanges.length} rows with null new_value`);
      }
      await writeToTarget("reservation_changes", validChanges);

      await migrateByInstance("reservation_events", instanceId);
      await migrateByInstance("sms_logs", instanceId);
      await migrateByInstance("customer_reminders", instanceId);

      // 8. Offers system
      await migrateByInstance("offer_scopes", instanceId);
      await migrateByInstance("offers", instanceId);

      const offers = await readAll("offers", { col: "instance_id", val: instanceId });
      const offerIds = offers.map((o: any) => o.id);
      await migrateByIds("offer_options", "offer_id", offerIds);

      const options = await readByIds("offer_options", "offer_id", offerIds);
      const optionIds = options.map((o: any) => o.id);
      await migrateByIds("offer_option_items", "option_id", optionIds);
      await migrateByIds("offer_text_blocks", "offer_id", offerIds);
      await migrateByIds("offer_history", "offer_id", offerIds);
      await migrateByIds("offer_views", "offer_id", offerIds);

      for (const t of [
        "offer_scope_products", "offer_scope_extras", "offer_scope_extra_products",
        "offer_scope_variants", "offer_scope_variant_products", "offer_reminders",
      ]) await migrateByInstance(t, instanceId);

      // 9. Followup
      await migrateByInstance("followup_events", instanceId);
      await migrateByInstance("followup_tasks", instanceId);

      // 10. Protocols (depends on reservations)
      await migrateByInstance("vehicle_protocols", instanceId);
      const protocols = await readAll("vehicle_protocols", { col: "instance_id", val: instanceId });
      const protocolIds = protocols.map((p: any) => p.id);
      await migrateByIds("protocol_damage_points", "protocol_id", protocolIds);

      // 11. Trainings (depends on stations)
      await migrateByInstance("trainings", instanceId);

      // 12. Sales
      await migrateByInstance("sales_orders", instanceId);
      const salesOrders = await readAll("sales_orders", { col: "instance_id", val: instanceId });
      const orderIds = salesOrders.map((o: any) => o.id);
      await migrateByIds("sales_order_items", "order_id", orderIds);

      // 13. Station employees
      const stations = await readAll("stations", { col: "instance_id", val: instanceId });
      const stationIds = stations.map((s: any) => s.id);
      if (stationIds.length > 0) await migrateByIds("station_employees", "station_id", stationIds);

      // 14. Time entries (depends on employees)
      await migrateByInstance("time_entries", instanceId);

      // 15. Yard vehicles
      await migrateByInstance("yard_vehicles", instanceId);

      // 16. Restore correct station_limit in instance_subscriptions
      if (subs.length > 0) {
        await writeToTarget("instance_subscriptions", subs);
        log.push(`instance_subscriptions: restored original station_limit`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: migrateAll ? "all" : "single",
        slug: migrateAll ? "ALL" : slug,
        instances_count: instances.length,
        dry_run: dryRun,
        log,
        errors,
        summary: { total_log_entries: log.length, errors_count: errors.length },
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), stack: (err as Error)?.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
