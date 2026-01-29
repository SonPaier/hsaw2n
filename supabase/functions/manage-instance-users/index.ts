import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageUserRequest {
  action: 'list' | 'create' | 'update' | 'delete' | 'block' | 'unblock' | 'reset-password';
  instanceId: string;
  userId?: string; // Required for update, delete, block, unblock, reset-password
  username?: string;
  password?: string;
  role?: 'admin' | 'employee' | 'hall';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller's authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Brak autoryzacji' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Nieprawidłowy token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's roles
    const { data: callerRoles } = await supabase
      .from('user_roles')
      .select('role, instance_id')
      .eq('user_id', caller.id);

    const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin');

    // Parse request body
    const body: ManageUserRequest = await req.json();
    const { action, instanceId, userId, username, password, role } = body;

    if (!instanceId) {
      return new Response(
        JSON.stringify({ error: 'Brak ID instancji' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller has permission to manage users in this instance
    const isInstanceAdmin = callerRoles?.some(
      r => r.role === 'admin' && r.instance_id === instanceId
    );

    if (!isSuperAdmin && !isInstanceAdmin) {
      return new Response(
        JSON.stringify({ error: 'Brak uprawnień do zarządzania użytkownikami w tej instancji' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    switch (action) {
      case 'list': {
        // List users in instance (admin only) - use service role to bypass RLS safely
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, email, is_blocked, created_at')
          .eq('instance_id', instanceId)
          .order('created_at', { ascending: false });

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          return new Response(
            JSON.stringify({ error: 'Nie udało się pobrać listy użytkowników' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userIds = profiles?.map((p: any) => p.id) || [];

        const { data: roles, error: rolesError } = userIds.length
          ? await supabase
              .from('user_roles')
              .select('user_id, role')
              .eq('instance_id', instanceId)
              .in('user_id', userIds)
          : { data: [], error: null };

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
          return new Response(
            JSON.stringify({ error: 'Nie udało się pobrać ról użytkowników' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const users = (profiles || []).map((profile: any) => {
          const userRoles = (roles || []).filter((r: any) => r.user_id === profile.id).map((r: any) => r.role);
          // Determine role priority: admin > hall > employee
          let userRole = 'employee';
          if (userRoles.includes('admin')) {
            userRole = 'admin';
          } else if (userRoles.includes('hall')) {
            userRole = 'hall';
          }
          return {
            id: profile.id,
            username: profile.username || '',
            email: profile.email || '',
            is_blocked: !!profile.is_blocked,
            created_at: profile.created_at || new Date().toISOString(),
            role: userRole,
          };
        });

        return new Response(
          JSON.stringify({ success: true, users }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        if (!username || !password || !role) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: username, password, role' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate role
        if (role !== 'admin' && role !== 'employee' && role !== 'hall') {
          return new Response(
            JSON.stringify({ error: 'Nieprawidłowa rola. Dozwolone: admin, employee, hall' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if username is unique within instance
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('username', username)
          .maybeSingle();

        if (existingUser) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik o tej nazwie już istnieje w tej instancji' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate unique email for auth (instance-specific)
        const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${instanceId.slice(0, 8)}@internal.local`;

        // Create user in auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createError || !newUser.user) {
          console.error('Error creating user:', createError);
          return new Response(
            JSON.stringify({ error: 'Nie udało się utworzyć użytkownika' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update profile with username and instance_id
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username,
            instance_id: instanceId,
            is_blocked: false,
          })
          .eq('id', newUser.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          // Try to clean up the created user
          await supabase.auth.admin.deleteUser(newUser.user.id);
          return new Response(
            JSON.stringify({ error: 'Nie udało się skonfigurować profilu użytkownika' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Assign role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: newUser.user.id,
            role: role,
            instance_id: instanceId,
          });

        if (roleError) {
          console.error('Error assigning role:', roleError);
          await supabase.auth.admin.deleteUser(newUser.user.id);
          return new Response(
            JSON.stringify({ error: 'Nie udało się przypisać roli użytkownikowi' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`User created: ${username} (${role}) in instance ${instanceId}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            userId: newUser.user.id,
            message: 'Użytkownik utworzony pomyślnie'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user belongs to this instance
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update username if provided
        if (username) {
          // Check if new username is unique within instance
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('instance_id', instanceId)
            .eq('username', username)
            .neq('id', userId)
            .maybeSingle();

          if (existingUser) {
            return new Response(
              JSON.stringify({ error: 'Użytkownik o tej nazwie już istnieje w tej instancji' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ username })
            .eq('id', userId);

          if (updateError) {
            console.error('Error updating username:', updateError);
            return new Response(
              JSON.stringify({ error: 'Nie udało się zaktualizować nazwy użytkownika' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Update role if provided
        if (role) {
          if (role !== 'admin' && role !== 'employee' && role !== 'hall') {
            return new Response(
              JSON.stringify({ error: 'Nieprawidłowa rola. Dozwolone: admin, employee, hall' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId)
            .eq('instance_id', instanceId);

          if (roleError) {
            console.error('Error updating role:', roleError);
            return new Response(
              JSON.stringify({ error: 'Nie udało się zaktualizować roli użytkownika' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        console.log(`User updated: ${userId} in instance ${instanceId}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Użytkownik zaktualizowany' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'block':
      case 'unblock': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user belongs to this instance
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prevent blocking yourself
        if (userId === caller.id) {
          return new Response(
            JSON.stringify({ error: 'Nie możesz zablokować samego siebie' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isBlocked = action === 'block';
        const { error: blockError } = await supabase
          .from('profiles')
          .update({ is_blocked: isBlocked })
          .eq('id', userId);

        if (blockError) {
          console.error('Error blocking/unblocking user:', blockError);
          return new Response(
            JSON.stringify({ error: `Nie udało się ${isBlocked ? 'zablokować' : 'odblokować'} użytkownika` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`User ${action}ed: ${userId} in instance ${instanceId}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: isBlocked ? 'Użytkownik zablokowany' : 'Użytkownik odblokowany' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset-password': {
        if (!userId || !password) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId, password' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user belongs to this instance
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Reset password using admin API
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          userId,
          { password }
        );

        if (passwordError) {
          console.error('Error resetting password:', passwordError);
          return new Response(
            JSON.stringify({ error: 'Nie udało się zresetować hasła' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Password reset for user: ${userId} in instance ${instanceId}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Hasło zostało zresetowane' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user belongs to this instance
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prevent deleting yourself
        if (userId === caller.id) {
          return new Response(
            JSON.stringify({ error: 'Nie możesz usunąć samego siebie' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if this is the last admin in the instance
        const { data: targetRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('instance_id', instanceId);

        const isTargetAdmin = targetRoles?.some(r => r.role === 'admin');

        if (isTargetAdmin) {
          // Count admins in this instance
          const { count: adminCount } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('instance_id', instanceId)
            .eq('role', 'admin');

          if (adminCount === 1) {
            return new Response(
              JSON.stringify({ error: 'Nie można usunąć ostatniego administratora instancji' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Delete user (this will cascade delete from profiles and user_roles due to FK)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
          console.error('Error deleting user:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Nie udało się usunąć użytkownika' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`User deleted: ${userId} from instance ${instanceId}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Użytkownik usunięty' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Nieznana akcja' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    await captureException(err, {
      transaction: "manage-instance-users",
      request: req,
      tags: { function: "manage-instance-users" },
    });
    return new Response(
      JSON.stringify({ error: 'Wystąpił nieoczekiwany błąd' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
