import { useState, useEffect } from 'react';
import { Loader2, UserPlus, MoreVertical, Shield, User, Lock, Unlock, Trash2, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import AddInstanceUserDialog from './AddInstanceUserDialog';
import EditInstanceUserDialog from './EditInstanceUserDialog';
import ResetPasswordDialog from './ResetPasswordDialog';
import DeleteUserDialog from './DeleteUserDialog';

interface InstanceUser {
  id: string;
  username: string;
  email: string;
  is_blocked: boolean;
  created_at: string;
  role: 'admin' | 'employee';
}

interface InstanceUsersTabProps {
  instanceId: string;
}

const InstanceUsersTab = ({ instanceId }: InstanceUsersTabProps) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<InstanceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<InstanceUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles for this instance
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, email, is_blocked, created_at')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for these users
      const userIds = profiles?.map(p => p.id) || [];
      
      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('instance_id', instanceId)
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: InstanceUser[] = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          username: profile.username || t('common.noName', 'Brak nazwy'),
          email: profile.email || '',
          is_blocked: profile.is_blocked || false,
          created_at: profile.created_at || new Date().toISOString(),
          role: (userRole?.role === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee',
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('instanceUsers.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instanceId) {
      fetchUsers();
    }
  }, [instanceId]);

  const handleBlockUnblock = async (user: InstanceUser) => {
    setActionLoading(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('instanceUsers.sessionExpired'));
        return;
      }

      const response = await supabase.functions.invoke('manage-instance-users', {
        body: {
          action: user.is_blocked ? 'unblock' : 'block',
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

      toast.success(user.is_blocked ? t('instanceUsers.userUnblocked') : t('instanceUsers.userBlocked'));
      fetchUsers();
    } catch (error: any) {
      console.error('Error blocking/unblocking user:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (user: InstanceUser) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleResetPassword = (user: InstanceUser) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
  };

  const handleDelete = (user: InstanceUser) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const getRoleBadge = (role: 'admin' | 'employee') => {
    if (role === 'admin') {
      return (
        <Badge variant="default" className="gap-1">
          <Shield className="w-3 h-3" />
          {t('instanceUsers.admin')}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <User className="w-3 h-3" />
        {t('instanceUsers.employee')}
      </Badge>
    );
  };

  const getStatusBadge = (isBlocked: boolean) => {
    if (isBlocked) {
      return <Badge variant="destructive">{t('instanceUsers.blocked')}</Badge>;
    }
    return <Badge variant="outline" className="border-green-500 text-green-700">{t('instanceUsers.active')}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      {/* Header */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">{t('instanceUsers.title')}</h3>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2 w-full sm:w-auto">
          <UserPlus className="w-4 h-4" />
          {t('instanceUsers.addUser')}
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('instanceUsers.noUsers')}</p>
          <Button 
            variant="link" 
            onClick={() => setAddDialogOpen(true)}
            className="mt-2"
          >
            {t('instanceUsers.addFirstUser')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Username */}
                    <div className="font-medium truncate">{user.username}</div>
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.is_blocked)}
                    </div>
                    {/* Date */}
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'd MMM yyyy', { locale: pl })}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MoreVertical className="w-4 h-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <User className="w-4 h-4 mr-2" />
                        {t('instanceUsers.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                        <KeyRound className="w-4 h-4 mr-2" />
                        {t('instanceUsers.resetPassword')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleBlockUnblock(user)}>
                        {user.is_blocked ? (
                          <>
                            <Unlock className="w-4 h-4 mr-2" />
                            {t('instanceUsers.unblock')}
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            {t('instanceUsers.block')}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(user)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('instanceUsers.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddInstanceUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        instanceId={instanceId}
        onSuccess={fetchUsers}
      />

      <EditInstanceUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        instanceId={instanceId}
        user={selectedUser}
        onSuccess={fetchUsers}
      />

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        instanceId={instanceId}
        user={selectedUser}
      />

      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        instanceId={instanceId}
        user={selectedUser}
        onSuccess={fetchUsers}
      />
    </div>
  );
};

export default InstanceUsersTab;
