import { useState, useEffect, useCallback, useRef } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
interface NotificationBellProps {
  instanceId: string;
  onOpenReservation?: (reservationId: string) => void;
  onConfirmReservation?: (reservationId: string) => void;
  onViewAllNotifications?: () => void;
  onNavigateToOffers?: () => void;
  onNavigateToReservations?: () => void;
}
export const NotificationBell = ({
  instanceId,
  onOpenReservation,
  onConfirmReservation,
  onViewAllNotifications,
  onNavigateToOffers,
  onNavigateToReservations
}: NotificationBellProps) => {
  const {
    t
  } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.read).length;
  const newNotifications = notifications.filter(n => !n.read);
  const earlierNotifications = notifications.filter(n => n.read);
  const channelNameRef = useRef<string | null>(null);
  const fetchNotifications = useCallback(async () => {
    if (!instanceId) return;
    const {
      data,
      error
    } = await supabase.from('notifications').select('*').eq('instance_id', instanceId).order('created_at', {
      ascending: false
    }).limit(10);
    if (error) {
      console.log('[NotificationBell] fetchNotifications error', error);
      return;
    }
    setNotifications(data ?? []);
  }, [instanceId]);
  useEffect(() => {
    if (!instanceId) return;
    fetchNotifications();

    // IMPORTANT: AdminLayout/AdminDashboard can render multiple bells at once.
    // Using a unique channel name prevents one component from removing another's subscription.
    const channelName = channelNameRef.current ?? `notifications-realtime-${instanceId}-${Math.random().toString(36).slice(2)}`;
    channelNameRef.current = channelName;
    console.log('[NotificationBell] subscribing', {
      instanceId,
      channelName
    });
    const channel = supabase.channel(channelName).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `instance_id=eq.${instanceId}`
    }, payload => {
      console.log('[NotificationBell] realtime payload', payload);
      fetchNotifications();
    }).subscribe(status => {
      console.log('[NotificationBell] channel status', status, {
        channelName
      });
    });
    return () => {
      console.log('[NotificationBell] unsubscribing', {
        instanceId,
        channelName
      });
      supabase.removeChannel(channel);
    };
  }, [instanceId, fetchNotifications]);
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await supabase.from('notifications').update({
        read: true
      }).eq('id', notification.id);
      setNotifications(prev => prev.map(n => n.id === notification.id ? {
        ...n,
        read: true
      } : n));
    }

    // Navigate based on entity type
    if (notification.entity_type === 'offer' && notification.entity_id) {
      setOpen(false);
      if (onNavigateToOffers) {
        onNavigateToOffers();
      } else {
        navigate(`/admin/offers`);
      }
    } else if (notification.entity_type === 'reservation' && notification.entity_id) {
      setOpen(false);
      if (onOpenReservation) {
        if (onNavigateToReservations) {
          onNavigateToReservations();
        }
        setTimeout(() => {
          onOpenReservation(notification.entity_id!);
        }, 100);
      } else if (onNavigateToReservations) {
        onNavigateToReservations();
      } else {
        navigate(`/admin/reservations`);
      }
    }
  };
  const handleConfirmReservation = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    if (!notification.entity_id) return;

    // Mark notification as read
    await supabase.from('notifications').update({
      read: true
    }).eq('id', notification.id);
    setNotifications(prev => prev.map(n => n.id === notification.id ? {
      ...n,
      read: true
    } : n));
    if (onConfirmReservation) {
      onConfirmReservation(notification.entity_id);
      toast.success(t('reservations.reservationConfirmed'));
    }
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
  return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" className="relative h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105">
          
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 text-xs font-bold bg-red-500 text-white rounded-full flex items-center justify-center border-2 border-background shadow-md">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-card border-border shadow-xl" align="end" sideOffset={8}>
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-lg">{t('notifications.title')}</h3>
        </div>
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? <div className="p-4 text-center text-muted-foreground">
              {t('notifications.noNotifications')}
            </div> : <div className="p-2">
              {newNotifications.length > 0 && <>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                    {t('notifications.new')}
                  </div>
                  {newNotifications.map(notification => <button key={notification.id} onClick={() => handleNotificationClick(notification)} className={cn("w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-colors flex gap-3 items-start", !notification.read && "bg-primary/5")}>
                      <span className="text-xl shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {notification.description && <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.description}
                          </p>}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-primary flex-1">
                            {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: pl
                    })}
                          </p>
                          {notification.type === 'reservation_new' && notification.entity_id && onConfirmReservation && <Button size="sm" variant="outline" className="h-6 text-xs gap-1 border-green-500 text-green-600 hover:bg-green-500 hover:text-white" onClick={e => handleConfirmReservation(e, notification)}>
                              <Check className="w-3 h-3" />
                              {t('common.confirm')}
                            </Button>}
                        </div>
                      </div>
                      {!notification.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                    </button>)}
                </>}
              
              {earlierNotifications.length > 0 && <>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase mt-2">
                    {t('notifications.earlier')}
                  </div>
                  {earlierNotifications.map(notification => <button key={notification.id} onClick={() => handleNotificationClick(notification)} className="w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-colors flex gap-3 items-start">
                      <span className="text-xl shrink-0 opacity-60">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-muted-foreground">{notification.title}</p>
                        {notification.description && <p className="text-xs text-muted-foreground/70 line-clamp-2">
                            {notification.description}
                          </p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: pl
                  })}
                        </p>
                      </div>
                    </button>)}
                </>}
            </div>}
        </ScrollArea>
        
        {notifications.length > 0 && <div className="p-2 border-t border-border">
            <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => {
          setOpen(false);
          if (onViewAllNotifications) {
            onViewAllNotifications();
          } else {
            navigate('/admin/notifications');
          }
        }}>
              {t('notifications.viewAll')}
            </Button>
          </div>}
      </PopoverContent>
    </Popover>;
};