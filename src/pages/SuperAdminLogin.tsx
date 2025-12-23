import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const SuperAdminLogin = () => {
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

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (formData.login === 'superadmin' && formData.password === 'super123') {
      toast.success('Zalogowano jako Super Admin');
      navigate('/super-admin');
    } else {
      setError('Nieprawidłowe dane logowania');
    }

    setIsLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Super Admin - Logowanie</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(280_100%_60%_/_0.1),_transparent_70%)]" />
        
        <div className="w-full max-w-md relative">
          <div className="glass-card p-8 card-elevated space-y-8 border-2 border-purple-500/20">
            {/* Logo */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
                <p className="text-sm text-muted-foreground mt-1">Panel zarządzania systemem</p>
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
                size="lg"
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30"
                disabled={isLoading}
              >
                {isLoading ? 'Logowanie...' : 'Zaloguj się'}
              </Button>
            </form>

            {/* Demo credentials hint */}
            <div className="text-center text-xs text-muted-foreground">
              <p>Demo: superadmin / super123</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SuperAdminLogin;
