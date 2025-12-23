import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, Lock, User, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    login: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo credentials check (in production this would be backend validation)
    if (formData.login === 'admin' && formData.password === 'admin123') {
      toast.success('Zalogowano pomyślnie');
      navigate('/admin');
    } else {
      setError('Nieprawidłowe dane logowania');
    }

    setIsLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Panel administracyjny - Logowanie</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(195_100%_50%_/_0.1),_transparent_70%)]" />
        
        <div className="w-full max-w-md relative">
          <div className="glass-card p-8 card-elevated space-y-8">
            {/* Logo */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center mx-auto glow-primary">
                <Car className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Panel Administracyjny</h1>
                <p className="text-sm text-muted-foreground mt-1">ARM CAR AUTO SPA</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="login" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Login
                </Label>
                <Input
                  id="login"
                  placeholder="Wprowadź login"
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  className="h-12"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  Hasło
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Wprowadź hasło"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-12"
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Logowanie...' : 'Zaloguj się'}
              </Button>
            </form>

            {/* Demo credentials hint */}
            <div className="text-center text-xs text-muted-foreground">
              <p>Demo: admin / admin123</p>
            </div>
          </div>

          {/* Back to booking link */}
          <div className="text-center mt-6">
            <a
              href="/"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              ← Powrót do rezerwacji
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;
