import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { setSentryUser, clearSentryUser } from '@/lib/sentry';

type AppRole = 'super_admin' | 'admin' | 'user' | 'employee';

interface UserRole {
  role: AppRole;
  instance_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
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
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, instance_id')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching roles:', error);
        return;
      }

      const userRoles = data?.map(r => ({
        role: r.role as AppRole,
        instance_id: r.instance_id
      })) || [];
      
      setRoles(userRoles);
      
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
    await supabase.auth.signOut();
    setRoles([]);
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
