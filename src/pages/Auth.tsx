import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    if (!authLoading && user) {
      navigate(returnTo);
    }
  }, [user, authLoading, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    if (password.length < 6) {
      toast.error('Hasło musi mieć minimum 6 znaków');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Nieprawidłowy email lub hasło');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Zalogowano pomyślnie');
          navigate(returnTo);
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Ten email jest już zarejestrowany');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Konto utworzone! Możesz się teraz zalogować.');
          setIsLogin(true);
        }
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
        <title>{isLogin ? 'Logowanie' : 'Rejestracja'} - ARM CAR AUTO SPA</title>
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
                {isLogin ? 'Zaloguj się' : 'Utwórz konto'}
              </h1>
              <p className="text-muted-foreground">
                {isLogin 
                  ? 'Zaloguj się do panelu administracyjnego' 
                  : 'Zarejestruj się, aby zarządzać rezerwacjami'
                }
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Imię i nazwisko</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Jan Kowalski"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    {isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin 
                    ? 'Nie masz konta? Zarejestruj się' 
                    : 'Masz już konto? Zaloguj się'
                  }
                </button>
              </div>
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
