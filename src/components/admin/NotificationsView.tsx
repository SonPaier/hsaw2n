import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Check } from 'lucide-react';
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

interface NotificationsViewProps {
  instanceId: string | null;
  onNavigateBack: () => void;
  onNavigateToOffers: () => void;
  onNavigateToReservations: () => void;
}

export default function NotificationsView({ 
  instanceId, 
  onNavigateBack,
  onNavigateToOffers,
  onNavigateToReservations 
}: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (notification.entity_type === 'offer') {
      onNavigateToOffers();
    } else if (notification.entity_type === 'reservation') {
      onNavigateToReservations();
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
      case 'reservation_cancelled_by_customer':
        return '🚫';
      case 'reservation_edited':
        return '✏️';
      case 'reservation_edited_by_customer':
        return '📝';
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
      case 'reservation_cancelled_by_customer':
        return <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/30">Anulowana przez klienta</Badge>;
      case 'reservation_edited':
        return <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">Edytowana</Badge>;
      case 'reservation_edited_by_customer':
        return <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/30">Zmieniona przez klienta</Badge>;
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
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Powiadomienia</h1>
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
    </>
  );
}
