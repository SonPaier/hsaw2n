import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface ForgotPasswordProps {
  subdomainSlug?: string;
}

const ForgotPassword = ({ subdomainSlug }: ForgotPasswordProps) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = subdomainSlug || paramSlug;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Podaj adres e-mail');
      return;
    }

    setLoading(true);
    try {
      // Determine reset redirect URL based on current location
      const origin = window.location.origin;
      const resetPath = slug ? `/${slug}/reset-password` : '/reset-password';
      const redirectTo = `${origin}${resetPath}`;

      // Send branded reset email via SMTP (same as offers)
      await supabase.functions.invoke('send-password-reset-email', {
        body: {
          email: email.trim(),
          slug,
          redirectTo,
        },
      });

      // Always show success to prevent account enumeration
      setSent(true);
    } catch {
      // Still show success to prevent enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  const loginPath = slug ? `/${slug}/login` : '/login';

  if (sent) {
    return (
      <>
        <Helmet>
          <title>Sprawdź swoją skrzynkę</title>
        </Helmet>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Sprawdź swoją skrzynkę</h1>
            <p className="text-muted-foreground">
              Jeśli konto z podanym adresem e-mail istnieje, wysłaliśmy link do zresetowania hasła.
              Sprawdź również folder spam.
            </p>
            <Link to={loginPath}>
              <Button variant="outline" className="gap-2 mt-4">
                <ArrowLeft className="w-4 h-4" />
                Wróć do logowania
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Resetowanie hasła</title>
        <meta name="description" content="Zresetuj swoje hasło" />
      </Helmet>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Resetowanie hasła</h1>
            <p className="text-muted-foreground">
              Podaj adres e-mail powiązany z Twoim kontem administratora.
              Wyślemy link do zresetowania hasła.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Adres e-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@firma.pl"
                  className="pl-10 h-12"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Wyślij link resetujący'
              )}
            </Button>
          </form>

          <div className="text-center">
            <Link to={loginPath} className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Wróć do logowania
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
