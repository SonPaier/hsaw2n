import { useState } from 'react';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
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
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  user: InstanceUser | null;
  onSuccess: () => void;
}

const DeleteUserDialog = ({ 
  open, 
  onOpenChange, 
  instanceId, 
  user,
  onSuccess 
}: DeleteUserDialogProps) => {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setConfirmText('');
  };

  const handleDelete = async () => {
    if (!user) return;

    if (confirmText !== user.username) {
      toast.error('Nazwa użytkownika nie zgadza się');
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
          action: 'delete',
          instanceId,
          userId: user.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Użytkownik został usunięty');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Nie udało się usunąć użytkownika');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Usuń użytkownika
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Ta operacja jest nieodwracalna!</p>
                  <p>Użytkownik straci dostęp do systemu i zostanie trwale usunięty.</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmUsername">
                  Wpisz <strong>{user.username}</strong> aby potwierdzić:
                </Label>
                <Input
                  id="confirmUsername"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={user.username}
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Anuluj
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || confirmText !== user.username}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Usuń użytkownika
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteUserDialog;
