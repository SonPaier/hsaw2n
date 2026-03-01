import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PasswordInput from '@/components/password/PasswordInput';
import PasswordConfirmInput from '@/components/password/PasswordConfirmInput';
import { usePasswordValidation } from '@/components/password/usePasswordValidation';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    validation,
    strength,
    confirmMatch,
    isFormValid: passwordValid,
  } = usePasswordValidation();

  useEffect(() => {
    let mounted = true;

    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && mounted) {
        setIsRecoveryMode(true);
        setCheckingSession(false);
      }
    });

    // Check URL hash for recovery token (legacy flow)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashType = hashParams.get('type');
    if (hashType === 'recovery') {
      setIsRecoveryMode(true);
    }

    // Check query params for human-readable token (new flow)
    const token = searchParams.get('token');
    const qType = searchParams.get('type');

    if (token && qType === 'recovery') {
      supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' })
        .then(({ error: verifyError }) => {
          if (!mounted) return;
          if (verifyError) {
            console.error('Token verification failed:', verifyError.message);
            setCheckingSession(false);
          } else {
            setIsRecoveryMode(true);
            setCheckingSession(false);
          }
        });
    } else {
      // Give legacy flow a moment to process
      const timeout = setTimeout(() => {
        if (mounted) setCheckingSession(false);
      }, 2000);
      return () => {
        mounted = false;
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordValid) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isRecoveryMode && !success) {
    return (
      <>
        <Helmet><title>Nieprawidłowy link</title></Helmet>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold text-foreground">Link wygasł lub jest nieprawidłowy</h1>
            <p className="text-muted-foreground">
              Poproś ponownie o link do resetowania hasła.
            </p>
            <Button onClick={() => navigate('/login', { replace: true })} variant="outline">
              Wróć do logowania
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Helmet><title>Hasło zmienione</title></Helmet>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Hasło zostało zmienione</h1>
            <p className="text-muted-foreground">
              Za chwilę zostaniesz przekierowany do strony logowania.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Nowe hasło</title>
      </Helmet>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Ustaw nowe hasło</h1>
            <p className="text-muted-foreground">
              Wprowadź nowe hasło dla swojego konta.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordInput
              value={password}
              onChange={setPassword}
              validation={validation}
              strength={strength}
              showStrength
              showRequirements
            />

            <PasswordConfirmInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              match={confirmMatch}
              label="Powtórz hasło"
            />

            <Button
              type="submit"
              className="w-full h-12"
              disabled={loading || !passwordValid}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Zapisz nowe hasło'
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
