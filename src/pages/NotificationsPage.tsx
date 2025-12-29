import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Check, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserInstanceId = async () => {
      if (!user) return;
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('instance_id, role')
        .eq('user_id', user.id);
      
      if (!rolesData || rolesData.length === 0) return;
      const adminRole = rolesData.find(r => r.role === 'admin' && r.instance_id);
      if (adminRole?.instance_id) {
        setInstanceId(adminRole.instance_id);
        return;
      }
      const isSuperAdmin = rolesData.some(r => r.role === 'super_admin');
      if (isSuperAdmin) {
        const { data: instances } = await supabase
          .from('instances')
          .select('id')
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (instances?.id) {
          setInstanceId(instances.id);
        }
      }
    };
    fetchUserInstanceId();
  }, [user]);

  useEffect(() => {
    if (!instanceId) return;
    
    const fetchNotifications = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setNotifications(data);
      }
      setLoading(false);
    };

    fetchNotifications();
  }, [instanceId]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id);
      
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }

    // Navigate based on entity type
    if (notification.entity_type === 'offer' && notification.entity_id) {
      navigate(`/admin/oferty?id=${notification.entity_id}`);
    } else if (notification.entity_type === 'reservation' && notification.entity_id) {
      navigate(`/admin/reservations?open=${notification.entity_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('instance_id', instanceId)
      .eq('read', false);
    
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDeleteAll = async () => {
    await supabase
      .from('notifications')
      .delete()
      .eq('instance_id', instanceId);
    
    setNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reservation_new':
        return '📅';
      case 'reservation_cancelled':
        return '❌';
      case 'reservation_edited':
        return '✏️';
      case 'offer_approved':
        return '✅';
      case 'offer_modified':
        return '📝';
      default:
        return '🔔';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'reservation_new':
        return <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">Nowa rezerwacja</Badge>;
      case 'reservation_cancelled':
        return <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/30">Anulowana</Badge>;
      case 'reservation_edited':
        return <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">Edytowana</Badge>;
      case 'offer_approved':
        return <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Oferta zaakceptowana</Badge>;
      case 'offer_modified':
        return <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">Oferta zmieniona</Badge>;
      default:
        return null;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AdminLayout title="Powiadomienia">
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Powiadomienia</h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} nieprzeczytanych` : 'Wszystko przeczytane'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <Check className="w-4 h-4 mr-1" />
                Oznacz wszystkie
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDeleteAll}>
                <Trash2 className="w-4 h-4 mr-1" />
                Usuń wszystkie
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-8">Ładowanie...</div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Brak powiadomień
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map(notification => (
              <Card
                key={notification.id}
                className={cn(
                  "cursor-pointer hover:bg-accent/50 transition-colors",
                  !notification.read && "bg-primary/5 border-primary/20"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4 flex gap-4 items-start">
                  <span className="text-2xl shrink-0">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={cn(
                        "font-medium",
                        notification.read && "text-muted-foreground"
                      )}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    {notification.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {getTypeBadge(notification.type)}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { 
                          addSuffix: true, 
                          locale: pl 
                        })}
                        {' · '}
                        {format(new Date(notification.created_at), 'dd.MM.yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default NotificationsPage;
