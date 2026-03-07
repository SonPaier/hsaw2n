import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin API to list all users
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw new Error(`Failed to list users: ${error.message}`);
      }

      if (!users || users.length === 0) break;
      allUsers.push(...users);
      if (users.length < perPage) break;
      page++;
    }

    // Now query auth.users directly via DB for encrypted_password
    // We use the service role key with raw SQL via pg
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      // Fallback: return users without encrypted_password
      console.warn("SUPABASE_DB_URL not set, returning users without encrypted_password");
      return new Response(JSON.stringify({ 
        users: allUsers.map(u => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          email_confirmed_at: u.email_confirmed_at,
          phone_confirmed_at: u.phone_confirmed_at,
          created_at: u.created_at,
          updated_at: u.updated_at,
          last_sign_in_at: u.last_sign_in_at,
          raw_user_meta_data: u.user_metadata,
          raw_app_meta_data: u.app_metadata,
          encrypted_password: null,
          role: u.role,
          aud: u.aud,
          confirmation_sent_at: u.confirmation_sent_at,
          confirmed_at: u.confirmed_at,
        })),
        count: allUsers.length,
        warning: "encrypted_password not available without SUPABASE_DB_URL"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Direct DB query for encrypted_password
    // Import postgres driver
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    
    const sql = postgres(dbUrl, { max: 1 });
    
    const dbUsers = await sql`
      SELECT 
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
      FROM auth.users
      ORDER BY created_at
    `;

    await sql.end();

    console.log(`Dumped ${dbUsers.length} auth.users with encrypted_password`);

    return new Response(JSON.stringify({ 
      users: dbUsers,
      count: dbUsers.length 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
