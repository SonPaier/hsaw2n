import { useMemo, useCallback, useEffect, useState } from 'react';
import { useSessionStorageState } from '@/hooks/useSessionStorageState';
import { useTranslation } from 'react-i18next';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Search, Phone, MessageSquare, Check, Trash2, AlertCircle, CheckCircle2, Calendar, Clock, GraduationCap } from 'lucide-react';
import { normalizeSearchQuery } from '@/lib/textUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from './AdminTabsList';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import ServiceTag from './ServiceTag';
import CustomerEditDrawer from './CustomerEditDrawer';
import { supabase } from '@/integrations/supabase/client';
import type { Training } from './AddTrainingDrawer';

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
  photo_urls?: string[] | null;
  assigned_employee_ids?: string[] | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  company?: string | null;
  nip?: string | null;
  address?: string | null;
  source?: string;
}

interface Employee {
  id: string;
  name: string;
  active: boolean;
}

// Unified item for sorting/grouping
interface ListItem {
  type: 'reservation' | 'training';
  date: string;
  start_time: string;
  data: Reservation | Training;
}

interface ReservationsViewProps {
  reservations: Reservation[];
  allServices: Service[];
  onReservationClick: (reservation: Reservation) => void;
  onConfirmReservation: (reservationId: string) => void;
  onRejectReservation: (reservationId: string) => void;
  trainings?: Training[];
  trainingsEnabled?: boolean;
  onTrainingClick?: (training: Training) => void;
  onDeleteTraining?: (trainingId: string) => void;
  employees?: Employee[];
}

type TabValue = 'all' | 'reservations' | 'trainings';

const DEBOUNCE_MS = 300;

const ReservationsView = ({
  reservations,
  allServices,
  onReservationClick,
  onConfirmReservation,
  onRejectReservation,
  trainings = [],
  trainingsEnabled = false,
  onTrainingClick,
  onDeleteTraining,
  employees = [],
}: ReservationsViewProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useSessionStorageState<TabValue>('reservations-active-tab', 'all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reservationToReject, setReservationToReject] = useState<Reservation | null>(null);
  const [deleteTrainingDialogOpen, setDeleteTrainingDialogOpen] = useState(false);
  const [trainingToDelete, setTrainingToDelete] = useState<Training | null>(null);
  
  // Customer drawer state
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // If trainings got disabled, reset tab
  useEffect(() => {
    if (!trainingsEnabled && activeTab === 'trainings') {
      setActiveTab('all');
    }
  }, [trainingsEnabled, activeTab, setActiveTab]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) {
      map.set(emp.id, emp.name);
    }
    return map;
  }, [employees]);

  const formatDateHeader = (dateStr: string): string => {
    const date = parseISO(dateStr);
    if (isToday(date)) {
      return `${t('dates.today')}, ${format(date, 'd MMMM', { locale: pl })}`;
    }
    if (isTomorrow(date)) {
      return `${t('dates.tomorrow')}, ${format(date, 'd MMMM', { locale: pl })}`;
    }
    return format(date, 'EEEE, d MMMM', { locale: pl });
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build unified list items
  const allItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservationItems: ListItem[] = reservations
      .filter(r => {
        const resDate = parseISO(r.reservation_date);
        resDate.setHours(0, 0, 0, 0);
        return resDate >= today;
      })
      .map(r => ({ type: 'reservation' as const, date: r.reservation_date, start_time: r.start_time, data: r }));

    const trainingItems: ListItem[] = trainings
      .filter(tr => {
        const trDate = parseISO(tr.start_date);
        trDate.setHours(0, 0, 0, 0);
        return trDate >= today;
      })
      .map(tr => ({ type: 'training' as const, date: tr.start_date, start_time: tr.start_time, data: tr }));

    return [...reservationItems, ...trainingItems];
  }, [reservations, trainings]);

  // Filter by tab
  const tabFiltered = useMemo(() => {
    switch (activeTab) {
      case 'reservations':
        return allItems.filter(i => i.type === 'reservation');
      case 'trainings':
        return allItems.filter(i => i.type === 'training');
      default:
        return allItems;
    }
  }, [allItems, activeTab]);

  // Search filter
  const searchFiltered = useMemo(() => {
    if (!debouncedQuery.trim()) return tabFiltered;
    const query = debouncedQuery.toLowerCase().trim();
    const normalizedQuery = normalizeSearchQuery(query);

    return tabFiltered.filter(item => {
      if (item.type === 'reservation') {
        const r = item.data as Reservation;
        return (
          (r.confirmation_code && normalizeSearchQuery(r.confirmation_code).toLowerCase().includes(normalizedQuery)) ||
          r.customer_name?.toLowerCase().includes(query) ||
          (r.customer_phone && normalizeSearchQuery(r.customer_phone).includes(normalizedQuery)) ||
          r.vehicle_plate?.toLowerCase().includes(query)
        );
      } else {
        const tr = item.data as Training;
        return (
          tr.title?.toLowerCase().includes(query) ||
          tr.training_type?.toLowerCase().includes(query)
        );
      }
    });
  }, [tabFiltered, debouncedQuery]);

  // Sort and group by date
  const groupedItems = useMemo(() => {
    const sorted = [...searchFiltered].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

    const groups: Record<string, ListItem[]> = {};
    for (const item of sorted) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    }
    return groups;
  }, [searchFiltered]);

  const groupDates = Object.keys(groupedItems).sort();

  // Counts for tabs
  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingRes = reservations.filter(r => {
      const d = parseISO(r.reservation_date);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });
    const upcomingTr = trainings.filter(tr => {
      const d = parseISO(tr.start_date);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });
    return {
      all: upcomingRes.length + upcomingTr.length,
      reservations: upcomingRes.length,
      trainings: upcomingTr.length,
    };
  }, [reservations, trainings]);

  const handleRejectClick = (e: React.MouseEvent, reservation: Reservation) => {
    e.stopPropagation();
    setReservationToReject(reservation);
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (reservationToReject) {
      onRejectReservation(reservationToReject.id);
      setRejectDialogOpen(false);
      setReservationToReject(null);
    }
  };

  const handleCancelReject = () => {
    setRejectDialogOpen(false);
    setReservationToReject(null);
  };

  const handleDeleteTrainingClick = (e: React.MouseEvent, training: Training) => {
    e.stopPropagation();
    setTrainingToDelete(training);
    setDeleteTrainingDialogOpen(true);
  };

  const handleConfirmDeleteTraining = () => {
    if (trainingToDelete && onDeleteTraining) {
      onDeleteTraining(trainingToDelete.id);
      setDeleteTrainingDialogOpen(false);
      setTrainingToDelete(null);
    }
  };

  const handleCustomerClick = async (e: React.MouseEvent, reservation: Reservation) => {
    e.stopPropagation();
    
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('instance_id', reservation.instance_id)
      .eq('phone', reservation.customer_phone)
      .maybeSingle();
    
    if (customer) {
      setSelectedCustomer(customer);
    } else {
      setSelectedCustomer({
        id: '',
        name: reservation.customer_name,
        phone: reservation.customer_phone,
        email: null,
        notes: null,
      });
    }
    setSelectedInstanceId(reservation.instance_id);
    setCustomerDrawerOpen(true);
  };

  const renderServicePills = (reservation: Reservation) => {
    const services = reservation.services_data || (reservation.service ? [reservation.service] : []);
    if (services.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {services.map((service, idx) => (
          <ServiceTag key={idx} name={service.name} shortcut={service.shortcut} />
        ))}
      </div>
    );
  };

  const getEmployeeNames = (ids: string[]) => {
    return ids.map(id => employeeMap.get(id)).filter(Boolean).join(', ');
  };

  const renderReservationCard = (reservation: Reservation) => {
    const timeRange = `${reservation.start_time?.slice(0, 5)} - ${reservation.end_time?.slice(0, 5)}`;
    const isPending = reservation.status === 'pending' || !reservation.status;

    return (
      <div
        key={reservation.id}
        onClick={() => onReservationClick(reservation)}
        className={cn(
          "p-4 transition-colors cursor-pointer hover:bg-background",
          isPending && "bg-amber-500/5"
        )}
      >
        {/* Desktop layout */}
        <div className="hidden sm:flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              isPending ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600"
            )}>
              {isPending ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
            
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-foreground tabular-nums flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {timeRange}
                </span>
                {reservation.station && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{reservation.station.name}</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{reservation.vehicle_plate}</span>
                <span className="text-muted-foreground">•</span>
                <button
                  onClick={(e) => handleCustomerClick(e, reservation)}
                  className="text-sm text-primary hover:underline truncate"
                >
                  {reservation.customer_name}
                </button>
              </div>
              
              {renderServicePills(reservation)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPending && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-green-500 text-green-600 hover:bg-green-500 hover:text-white h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmReservation(reservation.id);
                }}
              >
                <Check className="w-4 h-4" />
                {t('common.confirm')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              asChild
            >
              <a
                href={`sms:${reservation.customer_phone}`}
                onClick={(e) => e.stopPropagation()}
                title={t('common.sendSms')}
              >
                <MessageSquare className="w-4 h-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              asChild
            >
              <a
                href={`tel:${reservation.customer_phone}`}
                onClick={(e) => e.stopPropagation()}
                title={t('common.call')}
              >
                <Phone className="w-4 h-4" />
              </a>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-muted"
              onClick={(e) => handleRejectClick(e, reservation)}
              title={t('reservations.rejectReservation')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
              isPending ? "bg-amber-500/20 text-amber-600" : "bg-green-500/20 text-green-600"
            )}>
              {isPending ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="text-sm font-medium text-foreground tabular-nums flex items-center gap-2">
                {timeRange}
                {reservation.station && (
                  <span className="text-muted-foreground font-normal">• {reservation.station.name}</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{reservation.vehicle_plate}</span>
                <span className="text-muted-foreground">•</span>
                <button
                  onClick={(e) => handleCustomerClick(e, reservation)}
                  className="text-sm text-primary hover:underline truncate"
                >
                  {reservation.customer_name}
                </button>
              </div>
              
              {renderServicePills(reservation)}
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2 pt-1">
            {isPending && (
              <Button
                variant="outline"
                className="h-9 gap-1 border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmReservation(reservation.id);
                }}
              >
                <Check className="w-4 h-4" />
                {t('common.confirm')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
              asChild
            >
              <a href={`sms:${reservation.customer_phone}`} onClick={(e) => e.stopPropagation()}>
                <MessageSquare className="w-4 h-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
              asChild
            >
              <a href={`tel:${reservation.customer_phone}`} onClick={(e) => e.stopPropagation()}>
                <Phone className="w-4 h-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-muted"
              onClick={(e) => handleRejectClick(e, reservation)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderTrainingCard = (training: Training) => {
    const timeRange = `${training.start_time?.slice(0, 5)} - ${training.end_time?.slice(0, 5)}`;
    const assignedNames = getEmployeeNames(training.assigned_employee_ids || []);

    return (
      <div
        key={training.id}
        onClick={() => onTrainingClick?.(training)}
        className="p-4 transition-colors cursor-pointer hover:bg-background"
      >
        {/* Desktop layout */}
        <div className="hidden sm:flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-violet-500/20 text-violet-600">
              <GraduationCap className="w-4 h-4" />
            </div>
            
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-foreground tabular-nums flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {timeRange}
                </span>
                {training.station && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{training.station.name}</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{training.title}</span>
                {assignedNames && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground truncate">{assignedNames}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-muted"
              onClick={(e) => handleDeleteTrainingClick(e, training)}
              title={t('trainings.deleteTraining')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/20 text-violet-600">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="text-sm font-medium text-foreground tabular-nums flex items-center gap-2">
                {timeRange}
                {training.station && (
                  <span className="text-muted-foreground font-normal">• {training.station.name}</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{training.title}</span>
                {assignedNames && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground truncate">{assignedNames}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-muted"
              onClick={(e) => handleDeleteTrainingClick(e, training)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderItem = (item: ListItem) => {
    if (item.type === 'reservation') {
      return renderReservationCard(item.data as Reservation);
    }
    return renderTrainingCard(item.data as Training);
  };

  const showTabs = trainingsEnabled;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-28">
      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground">{t('reservations.title')}</h1>
      
      {/* Sticky header on mobile */}
      <div className="sm:static sticky top-0 z-20 bg-background pb-4 space-y-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('reservations.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs - only when trainings enabled */}
        {showTabs && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <AdminTabsList columns={3}>
              <AdminTabsTrigger value="all">
                {t('common.all')}
                {counts.all > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                    {counts.all}
                  </Badge>
                )}
              </AdminTabsTrigger>
              <AdminTabsTrigger value="reservations">
                {t('reservations.washingAndDetailing')}
                {counts.reservations > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                    {counts.reservations}
                  </Badge>
                )}
              </AdminTabsTrigger>
              <AdminTabsTrigger value="trainings">
                {t('trainings.title')}
                {counts.trainings > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                    {counts.trainings}
                  </Badge>
                )}
              </AdminTabsTrigger>
            </AdminTabsList>
          </Tabs>
        )}
      </div>

      {/* Content */}
      {groupDates.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center mb-6">
            <Calendar className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {t('reservations.noReservations')}
          </h3>
          <p className="text-muted-foreground max-w-sm">
            {debouncedQuery
              ? t('reservations.noSearchResults')
              : t('reservations.noUpcoming')}
          </p>
        </div>
      ) : (
        <div>
          {groupDates.map((date) => (
            <div key={date}>
              <div className="sticky top-[120px] sm:top-0 z-10 flex items-center justify-center py-3 bg-background/95 backdrop-blur-sm">
                <div className="px-4 py-1 rounded-full bg-transparent">
                  <span className="font-medium capitalize text-foreground text-lg">
                    {formatDateHeader(date)}
                  </span>
                </div>
              </div>

              <div className="glass-card overflow-hidden divide-y divide-border/50 mb-4">
                {groupedItems[date].map((item) => renderItem(item))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject reservation dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) handleCancelReject(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reservations.confirmRejectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reservations.confirmRejectDescription', { 
                name: reservationToReject?.customer_name || '', 
                phone: reservationToReject?.customer_phone || '' 
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReject}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('reservations.yesReject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete training dialog */}
      <AlertDialog open={deleteTrainingDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteTrainingDialogOpen(false); setTrainingToDelete(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('trainings.deleteTraining')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('trainings.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteTraining}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer edit drawer */}
      <CustomerEditDrawer
        customer={selectedCustomer}
        instanceId={selectedInstanceId}
        open={customerDrawerOpen}
        onClose={() => {
          setCustomerDrawerOpen(false);
          setSelectedCustomer(null);
        }}
      />
    </div>
  );
};

export default ReservationsView;
