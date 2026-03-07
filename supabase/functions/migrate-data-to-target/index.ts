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
    const slug = body.slug || "armcar";
    const dryRun = body.dry_run || false;

    // Source client (this project)
    const source = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    // Target client (external Supabase)
    const targetUrl = Deno.env.get("TARGET_SUPABASE_URL")!;
    const targetKey = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY")!;
    const target = createClient(targetUrl, targetKey);

    // Get instance
    const { data: instance, error: instErr } = await source
      .from("instances")
      .select("*")
      .eq("slug", slug)
      .single();

    if (instErr || !instance) {
      return new Response(
        JSON.stringify({ error: "Instance not found", details: instErr }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instanceId = instance.id;
    const log: string[] = [];
    const errors: string[] = [];

    const migrateTable = async (
      tableName: string,
      filterCol: string,
      filterVal: string,
      batchSize = 500
    ) => {
      try {
        // Read all data from source
        let allData: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await source
            .from(tableName)
            .select("*")
            .eq(filterCol, filterVal)
            .range(offset, offset + batchSize - 1);

          if (error) {
            errors.push(`${tableName}: read error - ${error.message}`);
            return 0;
          }

          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allData = allData.concat(data);
            offset += batchSize;
            if (data.length < batchSize) hasMore = false;
          }
        }

        if (allData.length === 0) {
          log.push(`${tableName}: 0 rows (skipped)`);
          return 0;
        }

        if (dryRun) {
          log.push(`${tableName}: ${allData.length} rows (dry run)`);
          return allData.length;
        }

        // Insert into target in batches
        let inserted = 0;
        for (let i = 0; i < allData.length; i += batchSize) {
          const batch = allData.slice(i, i + batchSize);
          const { error: insertErr } = await target
            .from(tableName)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: true });

          if (insertErr) {
            errors.push(
              `${tableName}: insert error (batch ${i / batchSize}) - ${insertErr.message}`
            );
          } else {
            inserted += batch.length;
          }
        }

        log.push(`${tableName}: ${inserted}/${allData.length} rows migrated`);
        return inserted;
      } catch (e) {
        errors.push(`${tableName}: exception - ${String(e)}`);
        return 0;
      }
    };

    const migrateRelated = async (
      tableName: string,
      filterCol: string,
      filterIds: string[],
      batchSize = 500
    ) => {
      if (!filterIds.length) {
        log.push(`${tableName}: 0 parent IDs (skipped)`);
        return 0;
      }

      try {
        let allData: any[] = [];
        // Fetch in chunks of IDs (max 100 per query)
        for (let i = 0; i < filterIds.length; i += 100) {
          const idChunk = filterIds.slice(i, i + 100);
          const { data, error } = await source
            .from(tableName)
            .select("*")
            .in(filterCol, idChunk)
            .limit(10000);

          if (error) {
            errors.push(`${tableName}: read error - ${error.message}`);
          } else if (data) {
            allData = allData.concat(data);
          }
        }

        if (allData.length === 0) {
          log.push(`${tableName}: 0 rows (skipped)`);
          return 0;
        }

        if (dryRun) {
          log.push(`${tableName}: ${allData.length} rows (dry run)`);
          return allData.length;
        }

        let inserted = 0;
        for (let i = 0; i < allData.length; i += batchSize) {
          const batch = allData.slice(i, i + batchSize);
          const { error: insertErr } = await target
            .from(tableName)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: true });

          if (insertErr) {
            errors.push(
              `${tableName}: insert error - ${insertErr.message}`
            );
          } else {
            inserted += batch.length;
          }
        }

        log.push(`${tableName}: ${inserted}/${allData.length} rows migrated`);
        return inserted;
      } catch (e) {
        errors.push(`${tableName}: exception - ${String(e)}`);
        return 0;
      }
    };

    // ========== MIGRATION ORDER ==========
    // 1. Instance itself
    if (!dryRun) {
      const { error: instInsertErr } = await target
        .from("instances")
        .upsert([instance], { onConflict: "id" });
      if (instInsertErr) {
        errors.push(`instances: ${instInsertErr.message}`);
      } else {
        log.push("instances: 1 row migrated");
      }
    } else {
      log.push("instances: 1 row (dry run)");
    }

    // 2. Independent tables (instance_id filter)
    const instanceTables = [
      "stations",
      "service_categories",
      "employees",
      "customers",
      "unified_categories",
      "reminder_templates",
      "offer_variants",
      "offer_product_categories",
      "followup_services",
      "training_types",
      "halls",
      "workers_settings",
      "sales_products",
    ];

    for (const table of instanceTables) {
      await migrateTable(table, "instance_id", instanceId);
    }

    // 3. Tables dependent on level-1 tables
    const level2Tables = [
      "services",
      "customer_vehicles",
      "closed_days",
      "breaks",
      "notifications",
      "employee_breaks",
      "employee_days_off",
      "employee_edit_logs",
      "employee_permissions",
      "instance_features",
      "unified_services",
      "sms_message_settings",
      "login_attempts",
      "push_subscriptions",
      "price_lists",
      "products_library",
      "text_blocks_library",
    ];

    for (const table of level2Tables) {
      await migrateTable(table, "instance_id", instanceId);
    }

    // 4. Reservations & related
    await migrateTable("reservations", "instance_id", instanceId);
    await migrateTable("reservation_changes", "instance_id", instanceId);
    await migrateTable("reservation_events", "instance_id", instanceId);
    await migrateTable("sms_logs", "instance_id", instanceId);
    await migrateTable("customer_reminders", "instance_id", instanceId);

    // 5. Offers system
    await migrateTable("offer_scopes", "instance_id", instanceId);
    await migrateTable("offers", "instance_id", instanceId);

    // Get offer IDs for related tables
    const { data: offers } = await source
      .from("offers")
      .select("id")
      .eq("instance_id", instanceId);
    const offerIds = offers?.map((o) => o.id) || [];

    await migrateRelated("offer_options", "offer_id", offerIds);

    // Get option IDs
    const { data: options } = await source
      .from("offer_options")
      .select("id")
      .in("offer_id", offerIds.slice(0, 100));
    const optionIds = options?.map((o) => o.id) || [];

    await migrateRelated("offer_option_items", "option_id", optionIds);
    await migrateRelated("offer_text_blocks", "offer_id", offerIds);
    await migrateRelated("offer_history", "offer_id", offerIds);
    await migrateRelated("offer_views", "offer_id", offerIds);

    // Offer scope related
    const { data: scopes } = await source
      .from("offer_scopes")
      .select("id")
      .eq("instance_id", instanceId);
    const scopeIds = scopes?.map((s) => s.id) || [];

    await migrateTable("offer_scope_products", "instance_id", instanceId);
    await migrateTable("offer_scope_extras", "instance_id", instanceId);
    await migrateTable("offer_scope_extra_products", "instance_id", instanceId);
    await migrateTable("offer_scope_variants", "instance_id", instanceId);
    await migrateTable("offer_scope_variant_products", "instance_id", instanceId);
    await migrateTable("offer_reminders", "instance_id", instanceId);

    // 6. Followup
    await migrateTable("followup_events", "instance_id", instanceId);
    await migrateTable("followup_tasks", "instance_id", instanceId);

    // 7. Protocols
    await migrateTable("vehicle_protocols", "instance_id", instanceId);
    // Get protocol IDs
    const { data: protocols } = await source
      .from("vehicle_protocols")
      .select("id")
      .eq("instance_id", instanceId);
    const protocolIds = protocols?.map((p) => p.id) || [];
    await migrateRelated("protocol_damage_points", "protocol_id", protocolIds);

    // 8. Trainings
    await migrateTable("trainings", "instance_id", instanceId);

    // 9. Sales
    await migrateTable("sales_orders", "instance_id", instanceId);
    const { data: salesOrders } = await source
      .from("sales_orders")
      .select("id")
      .eq("instance_id", instanceId);
    const orderIds = salesOrders?.map((o) => o.id) || [];
    await migrateRelated("sales_order_items", "order_id", orderIds);

    // 10. Station employees
    await migrateTable("station_employees", "station_id", instanceId);
    // station_employees needs special handling - filter by station_ids
    const { data: stationData } = await source
      .from("stations")
      .select("id")
      .eq("instance_id", instanceId);
    const stationIds = stationData?.map((s) => s.id) || [];
    if (stationIds.length > 0) {
      await migrateRelated("station_employees", "station_id", stationIds);
    }

    // 11. Time entries
    await migrateTable("time_entries", "instance_id", instanceId);

    // 12. Yard vehicles
    await migrateTable("yard_vehicles", "instance_id", instanceId);

    // 13. Profiles & user_roles (special - filter by instance_id)
    await migrateTable("profiles", "instance_id", instanceId);
    await migrateTable("user_roles", "instance_id", instanceId);

    // 14. Subscription
    await migrateTable("instance_subscriptions", "instance_id", instanceId);

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        instance_id: instanceId,
        dry_run: dryRun,
        log,
        errors,
        summary: {
          total_tables: log.length,
          tables_with_errors: errors.length,
        },
      }, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), stack: (err as Error)?.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
