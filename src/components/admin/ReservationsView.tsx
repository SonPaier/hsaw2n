import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Search, Phone, MessageSquare, Check, Pencil, Trash2, AlertCircle, CheckCircle2, Calendar, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import ServiceTag from './ServiceTag';
interface Service {
  id: string;
  name: string;
  shortcut?: string | null;
}
interface Reservation {
  id: string;
  instance_id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_plate: string;
  reservation_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  station_id: string;
  status: string;
  confirmation_code: string;
  service?: {
    name: string;
    shortcut?: string | null;
  };
  services_data?: Array<{
    name: string;
    shortcut?: string | null;
  }>;
  station?: {
    name: string;
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
  price: number | null;
}
interface ReservationsViewProps {
  reservations: Reservation[];
  allServices: Service[];
  onReservationClick: (reservation: Reservation) => void;
  onConfirmReservation: (reservationId: string) => void;
  onRejectReservation: (reservationId: string) => void;
}
type TabValue = 'all' | 'confirmed' | 'pending';
const DEBOUNCE_MS = 300;
const ReservationsView = ({
  reservations,
  allServices,
  onReservationClick,
  onConfirmReservation,
  onRejectReservation
}: ReservationsViewProps) => {
  const {
    t
  } = useTranslation();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reservationToReject, setReservationToReject] = useState<string | null>(null);
  const formatDateHeader = (dateStr: string): string => {
    const date = parseISO(dateStr);
    if (isToday(date)) {
      return `${t('dates.today')}, ${format(date, 'd MMMM', {
        locale: pl
      })}`;
    }
    if (isTomorrow(date)) {
      return `${t('dates.tomorrow')}, ${format(date, 'd MMMM', {
        locale: pl
      })}`;
    }
    return format(date, 'EEEE, d MMMM', {
      locale: pl
    });
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter by tab
  const getTabFilteredReservations = useCallback((tab: TabValue, items: Reservation[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Only show upcoming reservations (today and future)
    const upcomingItems = items.filter(r => {
      const resDate = parseISO(r.reservation_date);
      resDate.setHours(0, 0, 0, 0);
      return resDate >= today;
    });
    switch (tab) {
      case 'confirmed':
        return upcomingItems.filter(r => r.status === 'confirmed');
      case 'pending':
        return upcomingItems.filter(r => r.status === 'pending' || !r.status);
      default:
        return upcomingItems;
    }
  }, []);

  // Search filter
  const searchFilteredReservations = useMemo(() => {
    const tabFiltered = getTabFilteredReservations(activeTab, reservations);
    if (!debouncedQuery.trim()) {
      return tabFiltered;
    }
    const query = debouncedQuery.toLowerCase().trim();
    return tabFiltered.filter(r => {
      const matchesCode = r.confirmation_code?.toLowerCase().includes(query);
      const matchesName = r.customer_name?.toLowerCase().includes(query);
      const matchesPhone = r.customer_phone?.includes(query);
      const matchesVehicle = r.vehicle_plate?.toLowerCase().includes(query);
      return matchesCode || matchesName || matchesPhone || matchesVehicle;
    });
  }, [reservations, debouncedQuery, activeTab, getTabFilteredReservations]);

  // Sort and group by date
  const groupedReservations = useMemo(() => {
    const sorted = [...searchFilteredReservations].sort((a, b) => {
      const dateCompare = a.reservation_date.localeCompare(b.reservation_date);
      if (dateCompare !== 0) return dateCompare;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
    const groups: Record<string, Reservation[]> = {};
    for (const reservation of sorted) {
      const date = reservation.reservation_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(reservation);
    }
    return groups;
  }, [searchFilteredReservations]);
  const groupDates = Object.keys(groupedReservations).sort();

  // Counts for tabs
  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingItems = reservations.filter(r => {
      const resDate = parseISO(r.reservation_date);
      resDate.setHours(0, 0, 0, 0);
      return resDate >= today;
    });
    return {
      all: upcomingItems.length,
      confirmed: upcomingItems.filter(r => r.status === 'confirmed').length,
      pending: upcomingItems.filter(r => r.status === 'pending' || !r.status).length
    };
  }, [reservations]);
  const handleRejectClick = (e: React.MouseEvent, reservationId: string) => {
    e.stopPropagation();
    setReservationToReject(reservationId);
    setRejectDialogOpen(true);
  };
  const handleConfirmReject = () => {
    if (reservationToReject) {
      onRejectReservation(reservationToReject);
      setRejectDialogOpen(false);
      setReservationToReject(null);
    }
  };
  const handleCancelReject = () => {
    setRejectDialogOpen(false);
    setReservationToReject(null);
  };
  const renderServicePills = (reservation: Reservation) => {
    const services = reservation.services_data || (reservation.service ? [reservation.service] : []);
    if (services.length === 0) return null;
    return <div className="flex flex-wrap gap-1 mt-1">
        {services.map((service, idx) => <ServiceTag key={idx} name={service.name} shortcut={service.shortcut} />)}
      </div>;
  };
  const renderReservationCard = (reservation: Reservation) => {
    const timeRange = `${reservation.start_time?.slice(0, 5)} - ${reservation.end_time?.slice(0, 5)}`;
    const isPending = reservation.status === 'pending' || !reservation.status;
    return <div key={reservation.id} onClick={() => onReservationClick(reservation)} className={cn("p-4 transition-colors cursor-pointer hover:bg-muted/50", isPending && "bg-amber-500/5")}>
        {/* Desktop layout */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", isPending ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600")}>
              {isPending ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{reservation.vehicle_plate}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground truncate">{reservation.customer_name}</span>
              </div>
              {renderServicePills(reservation)}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="font-medium text-foreground tabular-nums flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {timeRange}
              </div>
              {reservation.station && <div className="text-xs text-muted-foreground">{reservation.station.name}</div>}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="w-8 h-8" asChild>
                <a href={`tel:${reservation.customer_phone}`} onClick={e => e.stopPropagation()} title={t('common.call')}>
                  <Phone className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" size="icon" className="w-8 h-8" asChild>
                <a href={`sms:${reservation.customer_phone}`} onClick={e => e.stopPropagation()} title={t('common.sendSms')}>
                  <MessageSquare className="w-4 h-4" />
                </a>
              </Button>
              {isPending && <Button size="sm" variant="outline" className="gap-1 border-green-500 text-green-600 hover:bg-green-500 hover:text-white h-8" onClick={e => {
              e.stopPropagation();
              onConfirmReservation(reservation.id);
            }}>
                  <Check className="w-4 h-4" />
                  {t('common.confirm')}
                </Button>}
              <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={e => handleRejectClick(e, reservation.id)} title={t('reservations.rejectReservation')}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-start gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", isPending ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600")}>
              {isPending ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">{reservation.vehicle_plate}</div>
              <div className="text-sm text-muted-foreground">{reservation.customer_name}</div>
              <div className="mt-1 text-sm font-medium text-foreground tabular-nums">
                {timeRange}
                {reservation.station && <span className="text-muted-foreground font-normal"> • {reservation.station.name}</span>}
              </div>
              {renderServicePills(reservation)}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="icon" className="h-9 w-9" asChild>
              <a href={`tel:${reservation.customer_phone}`} onClick={e => e.stopPropagation()}>
                <Phone className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" asChild>
              <a href={`sms:${reservation.customer_phone}`} onClick={e => e.stopPropagation()}>
                <MessageSquare className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={e => handleRejectClick(e, reservation.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
            {isPending && <Button variant="outline" className="h-9 gap-1 border-green-500 text-green-600 hover:bg-green-500 hover:text-white" onClick={e => {
            e.stopPropagation();
            onConfirmReservation(reservation.id);
          }}>
                <Check className="w-4 h-4" />
                {t('common.confirm')}
              </Button>}
          </div>
        </div>
      </div>;
  };
  return <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('reservations.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="gap-1.5">
            {t('common.all')}
            {counts.all > 0 && <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                {counts.all}
              </Badge>}
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="gap-1.5">
            {t('reservations.confirmed')}
            {counts.confirmed > 0 && <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                {counts.confirmed}
              </Badge>}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            {t('reservations.pending')}
            {counts.pending > 0 && <Badge className="h-5 min-w-[20px] px-1.5 text-xs bg-amber-500 text-white border-amber-500">
                {counts.pending}
              </Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {groupDates.length === 0 ? <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center mb-6">
                <Calendar className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {t('reservations.noReservations')}
              </h3>
              <p className="text-muted-foreground max-w-sm">
                {debouncedQuery ? t('reservations.noSearchResults') : activeTab === 'pending' ? t('reservations.noPending') : activeTab === 'confirmed' ? t('reservations.noConfirmed') : t('reservations.noUpcoming')}
              </p>
            </div> : <div>
              {groupDates.map(date => <div key={date}>
                  {/* Sticky date header */}
                  <div className="sticky top-0 z-10 flex items-center justify-center py-3 bg-background/95 backdrop-blur-sm">
                    <div className="px-4 py-1 rounded-full bg-transparent">
                      <span className="font-medium capitalize text-foreground text-lg">
                        {formatDateHeader(date)}
                      </span>
                    </div>
                  </div>

                  {/* Reservations for this date */}
                  <div className="glass-card overflow-hidden divide-y divide-border/50 mb-4">
                    {groupedReservations[date].map(reservation => renderReservationCard(reservation))}
                  </div>
                </div>)}
            </div>}
        </TabsContent>
      </Tabs>

      {/* Reject confirmation dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={open => {
      if (!open) handleCancelReject();
    }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reservations.rejectConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reservations.rejectConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReject}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('reservations.yesReject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default ReservationsView;