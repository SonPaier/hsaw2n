import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { useInstanceFeatures } from '@/hooks/useInstanceFeatures';

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

const EMPLOYEE_FEATURES = [
  { key: 'offers', label: 'Oferty', description: 'Dostęp do modułu generowania ofert' },
  { key: 'followup', label: 'Follow-up', description: 'Dostęp do modułu follow-up klientów' },
];

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
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const { hasFeature } = useInstanceFeatures(instanceId);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setRole(user.role);
      if (user.role === 'employee') {
        fetchPermissions(user.id);
      } else {
        setPermissions({});
      }
    }
  }, [user]);

  const fetchPermissions = async (userId: string) => {
    setLoadingPermissions(true);
    try {
      const { data, error } = await supabase
        .from('employee_permissions')
        .select('feature_key, enabled')
        .eq('user_id', userId)
        .eq('instance_id', instanceId);

      if (error) throw error;

      const perms: Record<string, boolean> = {};
      data?.forEach(p => {
        perms[p.feature_key] = p.enabled;
      });
      setPermissions(perms);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleRoleChange = (newRole: 'employee' | 'admin') => {
    if (newRole === 'admin' && role !== 'admin') {
      setPendingRole('admin');
      setShowAdminConfirm(true);
    } else {
      setRole(newRole);
      if (newRole === 'employee' && user) {
        fetchPermissions(user.id);
      } else {
        setPermissions({});
      }
    }
  };

  const confirmAdminRole = () => {
    if (pendingRole === 'admin') {
      setRole('admin');
      setPermissions({});
    }
    setPendingRole(null);
    setShowAdminConfirm(false);
  };

  const cancelAdminRole = () => {
    setPendingRole(null);
    setShowAdminConfirm(false);
  };

  const handlePermissionChange = (featureKey: string, enabled: boolean) => {
    setPermissions(prev => ({ ...prev, [featureKey]: enabled }));
  };

  const savePermissions = async (userId: string) => {
    for (const feature of EMPLOYEE_FEATURES) {
      const enabled = permissions[feature.key] || false;
      
      const { error } = await supabase
        .from('employee_permissions')
        .upsert({
          user_id: userId,
          instance_id: instanceId,
          feature_key: feature.key,
          enabled,
        }, {
          onConflict: 'user_id,instance_id,feature_key',
        });

      if (error) {
        console.error('Error saving permission:', error);
        throw error;
      }
    }
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

      // Save permissions if employee
      if (role === 'employee') {
        await savePermissions(user.id);
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

  const availableFeatures = EMPLOYEE_FEATURES.filter(f => hasFeature(f.key as 'offers' | 'followup'));

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

            {/* Employee Permissions */}
            {role === 'employee' && availableFeatures.length > 0 && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Uprawnienia pracownika</Label>
                {loadingPermissions ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableFeatures.map((feature) => (
                      <div 
                        key={feature.key}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium">{feature.label}</p>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                        <Switch
                          checked={permissions[feature.key] || false}
                          onCheckedChange={(checked) => handlePermissionChange(feature.key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
