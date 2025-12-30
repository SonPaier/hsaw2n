import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Shield } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InstanceUser {
  id: string;
  username: string;
  role: 'admin' | 'employee';
}

interface EditInstanceUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  user: InstanceUser | null;
  onSuccess: () => void;
}

const EditInstanceUserDialog = ({ 
  open, 
  onOpenChange, 
  instanceId, 
  user,
  onSuccess 
}: EditInstanceUserDialogProps) => {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [loading, setLoading] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [pendingRole, setPendingRole] = useState<'admin' | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setRole(user.role);
    }
  }, [user]);

  const handleRoleChange = (newRole: 'employee' | 'admin') => {
    if (newRole === 'admin' && role !== 'admin') {
      setPendingRole('admin');
      setShowAdminConfirm(true);
    } else {
      setRole(newRole);
    }
  };

  const confirmAdminRole = () => {
    if (pendingRole === 'admin') {
      setRole('admin');
    }
    setPendingRole(null);
    setShowAdminConfirm(false);
  };

  const cancelAdminRole = () => {
    setPendingRole(null);
    setShowAdminConfirm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!username.trim()) {
      toast.error('Nazwa użytkownika jest wymagana');
      return;
    }

    if (username.length < 3) {
      toast.error('Nazwa użytkownika musi mieć co najmniej 3 znaki');
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
          action: 'update',
          instanceId,
          userId: user.id,
          username: username.trim(),
          role,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Dane użytkownika zostały zaktualizowane');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Nie udało się zaktualizować użytkownika');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edytuj użytkownika</DialogTitle>
            <DialogDescription>
              Zmień dane użytkownika {user.username}.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nazwa użytkownika</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="np. jan.kowalski"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rola</Label>
              <Select value={role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Pracownik</SelectItem>
                  <SelectItem value="admin">Admin Instancji</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === 'admin' 
                  ? 'Admin ma pełny dostęp do ustawień i zarządzania użytkownikami'
                  : 'Pracownik ma ograniczony dostęp do wybranych modułów'}
              </p>
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
                Zapisz zmiany
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showAdminConfirm} onOpenChange={setShowAdminConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Uprawnienia administratora
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Administrator instancji będzie miał dostęp do:
              </p>
              <ul className="list-disc list-inside text-left space-y-1 text-sm">
                <li>Wszystkich ustawień instancji</li>
                <li>Zarządzania użytkownikami</li>
                <li>Wszystkich modułów aplikacji</li>
                <li>Tworzenia i usuwania innych kont</li>
              </ul>
              <p className="text-amber-600 flex items-center gap-1 mt-2">
                <AlertTriangle className="w-4 h-4" />
                Przyznawaj te uprawnienia tylko zaufanym osobom.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelAdminRole}>
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdminRole}>
              Rozumiem, nadaj uprawnienia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditInstanceUserDialog;
