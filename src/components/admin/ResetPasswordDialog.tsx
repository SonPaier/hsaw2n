import { useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InstanceUser {
  id: string;
  username: string;
}

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  user: InstanceUser | null;
}

const ResetPasswordDialog = ({ 
  open, 
  onOpenChange, 
  instanceId, 
  user 
}: ResetPasswordDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!password) {
      toast.error('Hasło jest wymagane');
      return;
    }

    if (password.length < 6) {
      toast.error('Hasło musi mieć co najmniej 6 znaków');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Hasła nie są identyczne');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sesja wygasła');
        return;
      }

      const response = await supabase.functions.invoke('manage-instance-users', {
        body: {
          action: 'reset-password',
          instanceId,
          userId: user.id,
          password,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Hasło zostało zresetowane');
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Nie udało się zresetować hasła');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Resetuj hasło
          </DialogTitle>
          <DialogDescription>
            Ustaw nowe hasło dla użytkownika <strong>{user.username}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nowe hasło</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 znaków"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potwierdź hasło</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Powtórz hasło"
              autoComplete="new-password"
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Resetuj hasło
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
