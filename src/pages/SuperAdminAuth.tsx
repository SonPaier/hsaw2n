import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const SuperAdminAuth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, hasRole } = useAuth();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Determine redirect path based on domain
  const getRedirectPath = () => {
    const hostname = window.location.hostname;
    if (hostname === 'super.admin.n2wash.com') {
      return '/';
    }
    return '/super-admin';
  };

  // Redirect if already logged in as super_admin
  useEffect(() => {
    if (authLoading || !user) return;

    if (hasRole('super_admin')) {
      navigate(getRedirectPath(), { replace: true });
    }
  }, [authLoading, user, hasRole, navigate]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email jest wymagany';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Nieprawidłowy format email';
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

    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrors({ general: 'Nieprawidłowy email lub hasło' });
        } else {
          setErrors({ general: error.message });
        }
        setLoading(false);
        return;
      }

      // After successful login, check if user has super_admin role
      // The useEffect will handle redirect if role is correct
      // If not super_admin, show error
      setTimeout(() => {
        // Give time for auth state to update
        if (!hasRole('super_admin')) {
          setErrors({ general: 'Brak uprawnień Super Admina' });
          setLoading(false);
        }
      }, 1000);
    } catch (err) {
      setErrors({ general: 'Wystąpił błąd. Spróbuj ponownie.' });
      setLoading(false);
    }
  };

  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
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
        <title>Super Admin - N2Wash</title>
        <meta name="description" content="Panel Super Admina N2Wash" />
      </Helmet>

      <div className="min-h-screen flex">
        {/* Left side - Form */}
        <div className="w-full lg:w-1/2 flex flex-col bg-white dark:bg-slate-950">
          <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
            <div className="w-full max-w-md space-y-8">
              {/* Logo */}
              <div className="space-y-4 text-center">
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10">
                    <Shield className="w-8 h-8 text-amber-500" />
                  </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Panel Super Admina
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                  Zaloguj się używając swojego adresu email
                </p>
              </div>

              {/* General error */}
              {errors.general && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{errors.general}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      className={`pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${
                        errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                      autoComplete="email"
                      placeholder="admin@example.com"
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                    Hasło
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      className={`pl-10 pr-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${
                        errors.password ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 gap-2 bg-amber-500 hover:bg-amber-600 text-white text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Zaloguj się
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs text-slate-400">
              <span>© {new Date().getFullYear()} N2Works</span>
              <a
                href="https://n2works.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                n2works.com
              </a>
              <a
                href="tel:+48666610222"
                className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <Phone className="w-3 h-3" />
                +48 666 610 222
              </a>
              <a
                href="mailto:hey@n2works.com"
                className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <Mail className="w-3 h-3" />
                hey@n2works.com
              </a>
            </div>
          </div>
        </div>

        {/* Right side - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 relative overflow-hidden">
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
                <Shield className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold">Super Admin</h2>
              <p className="text-white/70 text-lg">
                Zarządzaj wszystkimi instancjami, użytkownikami i ustawieniami systemu N2Wash.
              </p>
            </div>
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
      </div>
    </>
  );
};

export default SuperAdminAuth;
