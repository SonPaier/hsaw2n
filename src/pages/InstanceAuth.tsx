import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { Car, User, Lock, ArrowRight, Loader2, Building2, Eye, EyeOff, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
interface Instance {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  active: boolean;
}
interface InstanceAuthProps {
  subdomainSlug?: string;
}
interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}
const InstanceAuth = ({
  subdomainSlug
}: InstanceAuthProps) => {
  const {
    slug: paramSlug
  } = useParams<{
    slug: string;
  }>();
  const slug = subdomainSlug || paramSlug;
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading,
    signIn,
    hasRole,
    hasInstanceRole
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(true);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const returnTo = '/admin';

  // Fetch instance by slug
  useEffect(() => {
    const fetchInstance = async () => {
      if (!slug) {
        setInstanceError('Brak identyfikatora instancji');
        setInstanceLoading(false);
        return;
      }
      const {
        data,
        error
      } = await supabase.from('instances').select('id, name, slug, logo_url, primary_color, active').eq('slug', slug).maybeSingle();
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
    const hasAccess = hasRole('super_admin') || hasInstanceRole('admin', instance.id) || hasInstanceRole('employee', instance.id);
    if (hasAccess) {
      supabase.from('profiles').select('is_blocked').eq('id', user.id).single().then(({
        data
      }) => {
        if (data?.is_blocked) {
          setErrors({
            general: 'Twoje konto zostało zablokowane'
          });
          return;
        }
        navigate(returnTo, {
          replace: true
        });
      });
    }
  }, [authLoading, instanceLoading, user, instance, hasRole, hasInstanceRole, navigate, returnTo]);
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!username.trim()) {
      newErrors.username = 'Login jest wymagany';
    }
    if (!password) {
      newErrors.password = 'Hasło jest wymagane';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validateForm()) {
      return;
    }
    if (!instance) {
      setErrors({
        general: 'Nie można zalogować - brak instancji'
      });
      return;
    }
    setLoading(true);
    try {
      const {
        data: profile,
        error: lookupError
      } = await supabase.from('profiles').select('id, email, is_blocked').eq('username', username).eq('instance_id', instance.id).maybeSingle();
      if (lookupError || !profile?.email) {
        setErrors({
          general: 'Nieprawidłowy login lub hasło'
        });
        setLoading(false);
        return;
      }
      if (profile.is_blocked) {
        setErrors({
          general: 'Twoje konto zostało zablokowane. Skontaktuj się z administratorem.'
        });
        setLoading(false);
        return;
      }
      const {
        error
      } = await signIn(profile.email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrors({
            general: 'Nieprawidłowy login lub hasło'
          });
        } else {
          setErrors({
            general: error.message
          });
        }
      } else {
        navigate(returnTo);
      }
    } catch (err) {
      setErrors({
        general: 'Wystąpił błąd. Spróbuj ponownie.'
      });
    } finally {
      setLoading(false);
    }
  };
  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };
  if (instanceLoading || authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  if (instanceError) {
    return <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-4">
            <Building2 className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{instanceError}</h1>
          <p className="text-muted-foreground">
            Sprawdź czy adres URL jest poprawny
          </p>
        </div>
      </div>;
  }
  return <>
      <Helmet>
        <title>Logowanie - {instance?.name || 'Panel'}</title>
        <meta name="description" content={`Zaloguj się do panelu ${instance?.name}`} />
      </Helmet>

      <div className="min-h-screen flex">
        {/* Left side - Form */}
        <div className="w-full lg:w-1/2 flex flex-col bg-white dark:bg-slate-950">
          <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
            <div className="w-full max-w-md space-y-8">
              {/* Logo */}
              <div className="space-y-4 text-center">
                {instance?.logo_url && <div className="flex justify-center mb-6">
                    <img src={instance.logo_url} alt={instance.name} className="h-20 object-contain" />
                  </div>}
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Logowanie do panelu administracyjnego
                </h1>
              </div>

              {/* General error */}
              {errors.general && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{errors.general}</p>
                </div>}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-700 dark:text-slate-300">Login</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input id="username" type="text" value={username} onChange={e => {
                    setUsername(e.target.value);
                    clearFieldError('username');
                  }} className={`pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${errors.username ? 'border-destructive focus-visible:ring-destructive' : ''}`} autoComplete="username" />
                  </div>
                  {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">Hasło</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => {
                    setPassword(e.target.value);
                    clearFieldError('password');
                  }} className={`pl-10 pr-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`} autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full h-12 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold" disabled={loading}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                      Zaloguj się
                      <ArrowRight className="w-5 h-5" />
                    </>}
                </Button>
              </form>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs text-slate-400">
              <span>© {new Date().getFullYear()} N2Works</span>
              <a href="https://n2works.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                n2works.com
              </a>
              <a href="tel:+48666610222" className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <Phone className="w-3 h-3" />
                +48 666 610 222
              </a>
              <a href="mailto:hey@n2works.com" className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <Mail className="w-3 h-3" />
                hey@n2works.com
              </a>
            </div>
          </div>
        </div>

        {/* Right side - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-blue-600 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute inset-0">
            <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-40 left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
            <div className="max-w-md text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm mb-4">
                <Car className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold">
                N2Wash.com
              </h2>
              <p className="text-white/70 text-lg">
                Zarządzaj rezerwacjami, usługami i klientami w jednym miejscu.
              </p>
            </div>
          </div>

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        </div>
      </div>
    </>;
};
export default InstanceAuth;