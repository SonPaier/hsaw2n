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

    const targetDbUrl = Deno.env.get("TARGET_SUPABASE_DB_URL");
    if (!targetDbUrl) {
      return new Response(JSON.stringify({ error: "TARGET_SUPABASE_DB_URL not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Debug: log sanitized URL (hide password)
    try {
      const urlObj = new URL(targetDbUrl);
      console.log(`DB host: ${urlObj.hostname}, port: ${urlObj.port}, db: ${urlObj.pathname}`);
    } catch {
      console.log(`DB URL parse failed, raw length: ${targetDbUrl.length}, starts with: ${targetDbUrl.substring(0, 30)}`);
    }

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

    log.push(`Rozpoczynam import ${users.length} użytkowników via SQL...`);
    log.push(`Tryb: ${dry_run ? 'DRY RUN' : 'LIVE'}`);

    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(targetDbUrl, { max: 1 });

    for (const u of users) {
      try {
        // Check if user already exists
        const existing = await sql`
          SELECT id FROM auth.users WHERE id = ${u.id}::uuid
        `;

        if (existing.length > 0) {
          log.push(`⏭️ SKIP ${u.email} (${u.id}) - już istnieje`);
          skipped++;
          continue;
        }

        if (dry_run) {
          log.push(`🔍 DRY: ${u.email} (${u.id}) - zostałby utworzony`);
          created++;
          continue;
        }

        // Direct SQL insert into auth.users with all original fields
        await sql`
          INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            invited_at,
            confirmation_token,
            confirmation_sent_at,
            recovery_token,
            recovery_sent_at,
            email_change_token_new,
            email_change,
            email_change_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            phone,
            phone_confirmed_at,
            phone_change,
            phone_change_token,
            phone_change_sent_at,
            email_change_token_current,
            email_change_confirm_status,
            banned_until,
            reauthentication_token,
            reauthentication_sent_at,
            is_sso_user,
            deleted_at,
            is_anonymous
          ) VALUES (
            ${u.id}::uuid,
            ${u.instance_id || '00000000-0000-0000-0000-000000000000'}::uuid,
            ${u.aud || 'authenticated'},
            ${u.role || 'authenticated'},
            ${u.email},
            ${u.encrypted_password || ''},
            ${u.email_confirmed_at || null},
            ${u.invited_at || null},
            ${u.confirmation_token || ''},
            ${u.confirmation_sent_at || null},
            ${u.recovery_token || ''},
            ${u.recovery_sent_at || null},
            ${u.email_change_token_new || ''},
            ${u.email_change || ''},
            ${u.email_change_sent_at || null},
            ${u.last_sign_in_at || null},
            ${JSON.stringify(u.raw_app_meta_data || {})}::jsonb,
            ${JSON.stringify(u.raw_user_meta_data || {})}::jsonb,
            ${u.is_super_admin || false},
            ${u.created_at || new Date().toISOString()},
            ${u.updated_at || new Date().toISOString()},
            ${u.phone || null},
            ${u.phone_confirmed_at || null},
            ${u.phone_change || ''},
            ${u.phone_change_token || ''},
            ${u.phone_change_sent_at || null},
            ${u.email_change_token_current || ''},
            ${u.email_change_confirm_status || 0},
            ${u.banned_until || null},
            ${u.reauthentication_token || ''},
            ${u.reauthentication_sent_at || null},
            ${u.is_sso_user || false},
            ${u.deleted_at || null},
            ${u.is_anonymous || false}
          )
        `;

        log.push(`✅ ${u.email} (${u.id}) - utworzony z oryginalnym hasłem`);
        created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`❌ ${u.email || u.id}: ${msg}`);
      }
    }

    await sql.end();

    log.push(`\n📊 Podsumowanie: utworzono=${created}, pominięto=${skipped}, błędów=${errors.length}`);

    return new Response(JSON.stringify({ 
      log, errors, created, skipped, total: users.length,
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
