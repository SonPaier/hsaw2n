import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Car, User, Lock, ArrowRight, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Instance {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  active: boolean;
}

const InstanceAuth = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signIn, hasRole, hasInstanceRole } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(true);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Always redirect to /admin for both admin and employee roles
  const returnTo = '/admin';

  // Fetch instance by slug
  useEffect(() => {
    const fetchInstance = async () => {
      if (!slug) {
        setInstanceError('Brak identyfikatora instancji');
        setInstanceLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('instances')
        .select('id, name, slug, logo_url, primary_color, active')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        setInstanceError('Wystąpił błąd podczas wczytywania instancji');
        setInstanceLoading(false);
        return;
      }

      if (!data) {
        setInstanceError('Nie znaleziono instancji');
        setInstanceLoading(false);
        return;
      }

      if (!data.active) {
        setInstanceError('Ta instancja jest nieaktywna');
        setInstanceLoading(false);
        return;
      }

      setInstance(data);
      setInstanceLoading(false);
    };

    fetchInstance();
  }, [slug]);

  // Redirect if already logged in with proper role
  useEffect(() => {
    if (authLoading || instanceLoading || !user || !instance) return;

    // Check if user has access to this instance
    const hasAccess = hasRole('super_admin') || 
                      hasInstanceRole('admin', instance.id) || 
                      hasInstanceRole('employee', instance.id);

    if (hasAccess) {
      // Check if user is blocked
      supabase
        .from('profiles')
        .select('is_blocked')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_blocked) {
            toast.error('Twoje konto zostało zablokowane');
            return;
          }
          navigate(returnTo, { replace: true });
        });
    }
  }, [authLoading, instanceLoading, user, instance, hasRole, hasInstanceRole, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    if (!instance) {
      toast.error('Nie można zalogować - brak instancji');
      return;
    }

    setLoading(true);

    try {
      // Look up email by username AND instance_id (username unique per instance)
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('id, email, is_blocked')
        .eq('username', username)
        .eq('instance_id', instance.id)
        .maybeSingle();

      if (lookupError || !profile?.email) {
        toast.error('Nieprawidłowy login lub hasło');
        setLoading(false);
        return;
      }

      // Check if user is blocked
      if (profile.is_blocked) {
        toast.error('Twoje konto zostało zablokowane. Skontaktuj się z administratorem.');
        setLoading(false);
        return;
      }

      const { error } = await signIn(profile.email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Nieprawidłowy login lub hasło');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Zalogowano pomyślnie');
        navigate(returnTo);
      }
    } catch (err) {
      toast.error('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  if (instanceLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (instanceError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-4">
            <Building2 className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{instanceError}</h1>
          <p className="text-muted-foreground">
            Sprawdź czy adres URL jest poprawny
          </p>
          <Button
            variant="link"
            onClick={() => navigate('/')}
            className="text-muted-foreground"
          >
            ← Powrót do strony głównej
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Logowanie - {instance?.name || 'Panel'}</title>
        <meta name="description" content={`Zaloguj się do panelu ${instance?.name}`} />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Gradient background with instance color */}
        <div 
          className="fixed inset-0 pointer-events-none"
          style={{
            background: instance?.primary_color 
              ? `linear-gradient(to bottom right, ${instance.primary_color}10, transparent, ${instance.primary_color}05)`
              : undefined
          }}
        />
        
        <div className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-md space-y-8">
            {/* Logo */}
            <div className="text-center space-y-2">
              {instance?.logo_url ? (
                <img 
                  src={instance.logo_url} 
                  alt={instance.name}
                  className="h-16 mx-auto object-contain mb-4"
                />
              ) : (
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                  style={{ 
                    background: instance?.primary_color 
                      ? `linear-gradient(to bottom right, ${instance.primary_color}, ${instance.primary_color}cc)`
                      : 'linear-gradient(to bottom right, hsl(var(--primary)), hsl(217.2 91.2% 59.8%))'
                  }}
                >
                  <Car className="w-8 h-8 text-primary-foreground" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-foreground">
                {instance?.name}
              </h1>
              <p className="text-muted-foreground">
                Zaloguj się do panelu
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Login</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Twój login"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Hasło</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={loading}
                style={{
                  backgroundColor: instance?.primary_color || undefined
                }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Zaloguj się
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Konta tworzone są przez administratora
              </p>
            </form>

            {/* Back to home */}
            <div className="text-center">
              <Button
                variant="link"
                onClick={() => navigate(`/rezerwacje?instance=${slug}`)}
                className="text-muted-foreground"
              >
                ← Powrót do rezerwacji
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstanceAuth;
