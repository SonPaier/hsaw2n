import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { setSentryUser, clearSentryUser } from '@/lib/sentry';

type AppRole = 'super_admin' | 'admin' | 'user' | 'employee' | 'hall' | 'sales';

interface UserRole {
  role: AppRole;
  instance_id: string | null;
  hall_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  username: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasInstanceRole: (role: AppRole, instanceId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  
  // Track previous user ID to avoid unnecessary loading on TOKEN_REFRESHED
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange:', event, 'userId:', session?.user?.id);
      
      setSession(session);
      setUser(session?.user ?? null);

      const newUserId = session?.user?.id ?? null;
      const userChanged = newUserId !== previousUserIdRef.current;

      // Fetch roles after auth state change (deferred to avoid deadlocks)
      if (session?.user) {
        // Only show loading and refetch roles if user actually changed
        // This prevents unmount/remount on TOKEN_REFRESHED for the same user
        if (userChanged) {
          previousUserIdRef.current = newUserId;
          setRolesLoading(true);
          setTimeout(() => {
            fetchUserRoles(session.user.id).finally(() => {
              setRolesLoading(false);
            });
          }, 0);
        }
      } else {
        previousUserIdRef.current = null;
        setRoles([]);
        setUsername(null);
        setRolesLoading(false);
        clearSentryUser();
      }
    });

    // Then check for existing session (await roles before clearing loading)
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setRolesLoading(true);
          try {
            await fetchUserRoles(session.user.id);
          } finally {
            setRolesLoading(false);
          }
        } else {
          setRoles([]);
          setUsername(null);
          setRolesLoading(false);
        }

        setSessionLoading(false);
      })
      .catch((err) => {
        console.error('Error getting session:', err);
        setSessionLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      // Fetch roles and profile in parallel to reduce requests
      const [rolesResult, profileResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role, instance_id, hall_id')
          .eq('user_id', userId),
        supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .maybeSingle()
      ]);

      if (rolesResult.error) {
        console.error('Error fetching roles:', rolesResult.error);
        return;
      }

      const userRoles = rolesResult.data?.map(r => ({
        role: r.role as AppRole,
        instance_id: r.instance_id,
        hall_id: r.hall_id
      })) || [];
      
      setRoles(userRoles);
      
      // Set username from profile
      if (profileResult.data?.username) {
        setUsername(profileResult.data.username);
      }
      
      // Update Sentry user context
      const primaryRole = userRoles.length > 0 ? userRoles[0].role : undefined;
      setSentryUser({
        id: userId,
        role: primaryRole,
      });
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const forceClearAuthStorage = () => {
    // Supabase Auth stores session tokens in localStorage under keys like:
    // `sb-<project-ref>-auth-token` and `sb-<project-ref>-auth-token-code-verifier`
    // If signOut fails (network/backend), auth-js may keep the session.
    // This is a best-effort local fallback to prevent being "stuck logged in".
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (!key.startsWith('sb-')) continue;
        if (key.includes('auth-token') || key.includes('code-verifier')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        if (!key.startsWith('sb-')) continue;
        if (key.includes('auth-token') || key.includes('code-verifier')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // ignore
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName || email,
        },
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    // Clear local state immediately to prevent redirects before onAuthStateChange fires
    setUser(null);
    setSession(null);
    setRoles([]);
    setUsername(null);
    previousUserIdRef.current = null;
    clearSentryUser();
    // Then sign out from Supabase (will also trigger onAuthStateChange)
    // IMPORTANT: auth-js will NOT clear the local session if the API call fails with some errors.
    // We add a local fallback to avoid being stuck in a logged-in state.
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Auth] signOut error (forcing local cleanup):', error);
      forceClearAuthStorage();
      // Full reload ensures the auth client doesn't keep an in-memory token.
      window.location.replace('/login');
    }
  };

  const hasRole = (role: AppRole) => {
    return roles.some(r => r.role === role);
  };

  const hasInstanceRole = (role: AppRole, instanceId: string) => {
    return roles.some(r => r.role === role && (r.instance_id === instanceId || r.instance_id === null));
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      roles,
      username,
      loading: sessionLoading || rolesLoading,
      signIn,
      signUp,
      signOut,
      hasRole,
      hasInstanceRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
