import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is super_admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target DB URL
    const targetUrl = Deno.env.get("TARGET_SUPABASE_URL");
    const targetServiceKey = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY");

    if (!targetUrl || !targetServiceKey) {
      return new Response(JSON.stringify({ error: "TARGET_SUPABASE_URL or TARGET_SUPABASE_SERVICE_ROLE_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetClient = createClient(targetUrl, targetServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse request body - expects { users: [...] } from dump-auth-users output
    const body = await req.json();
    const { users, dry_run = false } = body;

    if (!users || !Array.isArray(users)) {
      return new Response(JSON.stringify({ error: "Missing 'users' array in body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const log: string[] = [];
    const errors: string[] = [];
    let created = 0;
    let skipped = 0;

    log.push(`Rozpoczynam import ${users.length} użytkowników...`);
    log.push(`Tryb: ${dry_run ? 'DRY RUN' : 'LIVE'}`);

    for (const u of users) {
      try {
        // Check if user already exists in target
        const { data: existingUser } = await targetClient.auth.admin.getUserById(u.id);
        
        if (existingUser?.user) {
          log.push(`⏭️ SKIP ${u.email} (${u.id}) - już istnieje`);
          skipped++;
          continue;
        }

        if (dry_run) {
          log.push(`🔍 DRY: ${u.email} (${u.id}) - zostałby utworzony`);
          created++;
          continue;
        }

        // Create user in target with original UUID
        const { data: newUser, error: createError } = await targetClient.auth.admin.createUser({
          id: u.id,
          email: u.email,
          phone: u.phone || undefined,
          email_confirm: !!u.email_confirmed_at,
          phone_confirm: !!u.phone_confirmed_at,
          user_metadata: u.raw_user_meta_data || {},
          app_metadata: u.raw_app_meta_data || {},
          // Set a temporary password - we'll update encrypted_password via SQL
          password: `temp_${crypto.randomUUID()}`,
        });

        if (createError) {
          errors.push(`❌ ${u.email} (${u.id}): ${createError.message}`);
          continue;
        }

        log.push(`✅ ${u.email} (${u.id}) - utworzony`);
        created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`❌ ${u.email || u.id}: ${msg}`);
      }
    }

    // Now update encrypted_password for all users via direct DB connection if available
    // We need to use the target DB URL for this
    const targetDbUrl = Deno.env.get("TARGET_SUPABASE_DB_URL");
    
    if (targetDbUrl && !dry_run) {
      log.push(`\n🔑 Aktualizacja encrypted_password via SQL...`);
      
      try {
        const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
        const sql = postgres(targetDbUrl, { max: 1 });
        
        let passwordsUpdated = 0;
        for (const u of users) {
          if (u.encrypted_password) {
            try {
              await sql`
                UPDATE auth.users 
                SET encrypted_password = ${u.encrypted_password}
                WHERE id = ${u.id}::uuid
              `;
              passwordsUpdated++;
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              errors.push(`🔑 Hasło ${u.email}: ${msg}`);
            }
          }
        }
        
        log.push(`🔑 Zaktualizowano ${passwordsUpdated}/${users.length} haseł`);
        await sql.end();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`🔑 Połączenie DB: ${msg}`);
        log.push(`⚠️ Nie udało się zaktualizować haseł - brak TARGET_SUPABASE_DB_URL lub błąd połączenia`);
        log.push(`ℹ️ Hasła można zaktualizować ręcznie SQL-em na podstawie dumpa`);
      }
    } else if (!dry_run) {
      log.push(`\n⚠️ TARGET_SUPABASE_DB_URL nie skonfigurowany - hasła nie zostały zaktualizowane`);
      log.push(`ℹ️ Użytkownicy utworzeni z tymczasowymi hasłami. Uruchom SQL na docelowej bazie aby przywrócić oryginalne hasła.`);
    }

    log.push(`\n📊 Podsumowanie: utworzono=${created}, pominięto=${skipped}, błędów=${errors.length}`);

    return new Response(JSON.stringify({ 
      log, 
      errors,
      created,
      skipped,
      total: users.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
