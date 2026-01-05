import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Check, CalendarPlus, XCircle, Ban, Pencil, FileEdit, CircleCheck, FileText, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
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

const ITEMS_PER_PAGE = 20;

export default function NotificationsView({ 
  instanceId, 
  onNavigateBack,
  onNavigateToOffers,
  onNavigateToReservations 
}: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!instanceId) return;
    
    const fetchNotifications = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });

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
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'reservation_new':
        return { icon: <CalendarPlus className={cn(iconClass, "text-green-600")} />, bg: "bg-green-100" };
      case 'reservation_cancelled':
        return { icon: <XCircle className={cn(iconClass, "text-red-600")} />, bg: "bg-red-100" };
      case 'reservation_cancelled_by_customer':
        return { icon: <Ban className={cn(iconClass, "text-orange-600")} />, bg: "bg-orange-100" };
      case 'reservation_edited':
        return { icon: <Pencil className={cn(iconClass, "text-amber-600")} />, bg: "bg-amber-100" };
      case 'reservation_edited_by_customer':
        return { icon: <FileEdit className={cn(iconClass, "text-purple-600")} />, bg: "bg-purple-100" };
      case 'change_requested':
        return { icon: <FileEdit className={cn(iconClass, "text-orange-600")} />, bg: "bg-orange-100" };
      case 'offer_approved':
        return { icon: <CircleCheck className={cn(iconClass, "text-emerald-600")} />, bg: "bg-emerald-100" };
      case 'offer_modified':
        return { icon: <FileText className={cn(iconClass, "text-blue-600")} />, bg: "bg-blue-100" };
      default:
        return { icon: <Bell className={cn(iconClass, "text-muted-foreground")} />, bg: "bg-muted" };
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
  
  // Pagination
  const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedNotifications = notifications.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
        <>
          <div className="space-y-2">
            {paginatedNotifications.map(notification => (
              <Card
                key={notification.id}
                className={cn(
                  "cursor-pointer hover:bg-accent/50 transition-colors",
                  !notification.read && "bg-primary/5 border-primary/20"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4 flex gap-4 items-start">
                  {(() => {
                    const { icon, bg } = getNotificationIcon(notification.type);
                    return (
                      <div className={cn("shrink-0 w-10 h-10 rounded-lg flex items-center justify-center", bg)}>
                        {icon}
                      </div>
                    );
                  })()}
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
                        {format(new Date(notification.created_at), 'd MMM yyyy HH:mm', { locale: pl })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentPage} z {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
