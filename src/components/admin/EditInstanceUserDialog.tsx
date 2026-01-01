import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
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

const getEmployeeFeatures = (t: (key: string) => string) => [
  { key: 'offers', label: t('editUser.features.offers'), description: t('editUser.features.offersDesc') },
  { key: 'followup', label: t('editUser.features.followup'), description: t('editUser.features.followupDesc') },
];

const EditInstanceUserDialog = ({ 
  open, 
  onOpenChange, 
  instanceId, 
  user,
  onSuccess 
}: EditInstanceUserDialogProps) => {
  const { t } = useTranslation();
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
    const employeeFeatures = getEmployeeFeatures(t);
    for (const feature of employeeFeatures) {
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
      toast.error(t('editUser.usernameRequired'));
      return;
    }

    if (username.length < 3) {
      toast.error(t('editUser.usernameMinLength'));
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('auth.sessionExpired'));
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

      toast.success(t('editUser.userUpdated'));
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || t('editUser.updateError'));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const employeeFeatures = getEmployeeFeatures(t);
  const availableFeatures = employeeFeatures.filter(f => hasFeature(f.key as 'offers' | 'followup'));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('editUser.title')}</DialogTitle>
            <DialogDescription>
              {t('editUser.description', { username: user.username })}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('editUser.username')}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('editUser.usernamePlaceholder')}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">{t('editUser.role')}</Label>
              <Select value={role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">{t('editUser.roleEmployee')}</SelectItem>
                  <SelectItem value="admin">{t('editUser.roleAdmin')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === 'admin' 
                  ? t('editUser.adminHint')
                  : t('editUser.employeeHint')}
              </p>
            </div>

            {/* Employee Permissions */}
            {role === 'employee' && availableFeatures.length > 0 && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">{t('editUser.permissions')}</Label>
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('editUser.saveChanges')}
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
              {t('editUser.adminConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {t('editUser.adminConfirm.description')}
              </p>
              <ul className="list-disc list-inside text-left space-y-1 text-sm">
                <li>{t('editUser.adminConfirm.access1')}</li>
                <li>{t('editUser.adminConfirm.access2')}</li>
                <li>{t('editUser.adminConfirm.access3')}</li>
                <li>{t('editUser.adminConfirm.access4')}</li>
              </ul>
              <p className="text-amber-600 flex items-center gap-1 mt-2">
                <AlertTriangle className="w-4 h-4" />
                {t('editUser.adminConfirm.warning')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelAdminRole}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdminRole}>
              {t('editUser.adminConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditInstanceUserDialog;
