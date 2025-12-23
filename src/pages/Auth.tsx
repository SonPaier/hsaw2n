import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signIn, hasRole } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Determine where to redirect after login
  const getDefaultRedirect = () => {
    const path = window.location.pathname;
    if (path.includes('/admin')) return '/admin';
    if (path.includes('/super-admin')) return '/super-admin';
    return '/';
  };

  const returnTo = searchParams.get('returnTo') || getDefaultRedirect();

  useEffect(() => {
    if (!authLoading && user) {
      navigate(returnTo);
    }
  }, [user, authLoading, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    setLoading(true);

    try {
      // Look up email by username
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', username)
        .single();

      if (lookupError || !profile?.email) {
        toast.error('Nieprawidłowy login lub hasło');
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Logowanie - ARM CAR AUTO SPA</title>
        <meta name="description" content="Zaloguj się do systemu rezerwacji ARM CAR AUTO SPA" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 pointer-events-none" />
        
        <div className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-md space-y-8">
            {/* Logo */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-500 mb-4">
                <Car className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Zaloguj się
              </h1>
              <p className="text-muted-foreground">
                Zaloguj się do panelu administracyjnego
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
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={loading}
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
                Konta tworzone są przez administratora systemu
              </p>
            </form>

            {/* Back to home */}
            <div className="text-center">
              <Button
                variant="link"
                onClick={() => navigate('/')}
                className="text-muted-foreground"
              >
                ← Powrót do strony głównej
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
