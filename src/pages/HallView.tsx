import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AdminCalendar from '@/components/admin/AdminCalendar';
import ReservationDetailsDrawer from '@/components/admin/ReservationDetailsDrawer';
import AddReservationDialogV2 from '@/components/admin/AddReservationDialogV2';
import { ProtocolsView } from '@/components/protocols/ProtocolsView';
import { useInstancePlan } from '@/hooks/useInstancePlan';
import { Loader2, Calendar, FileText, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Hall } from '@/components/admin/halls/HallCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface Station {
  id: string;
  name: string;
  type: string;
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
  service_ids?: string[];
  service_items?: Array<{ service_id: string; custom_price: number | null }>;
  service?: {
    name: string;
    shortcut?: string | null;
  };
  station?: {
    name: string;
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
  price: number | null;
  has_unified_services?: boolean | null;
}

interface Break {
  id: string;
  instance_id: string;
  station_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

interface HallViewProps {
  isKioskMode?: boolean;
}

const HallView = ({ isKioskMode = false }: HallViewProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { hallId } = useParams<{ hallId: string }>();
  const { user, roles, signOut } = useAuth();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [hall, setHall] = useState<Hall | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [workingHours, setWorkingHours] = useState<Record<string, { open: string; close: string } | null> | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [yardVehicleCount, setYardVehicleCount] = useState(0);
  const [hallDataVisible, setHallDataVisible] = useState(true); // Toggle for sensitive data visibility
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [showProtocolsList, setShowProtocolsList] = useState(false);

  // Check if user has hall role (kiosk mode)
  const hasHallRole = roles.some(r => r.role === 'hall');
  const hasAdminOrEmployeeRole = roles.some(r => r.role === 'admin' || r.role === 'employee');
  const effectiveKioskMode = isKioskMode || hasHallRole;

  // Check if we're on /admin/... path
  const isAdminPath = location.pathname.startsWith('/admin');

  // Check subscription plan for protocols access
  const { hasFeature, planSlug } = useInstancePlan(instanceId);
  const canAccessProtocols = hasFeature('vehicle_reception_protocol') || planSlug === 'detailing';

  // Handle navigation based on role
  const handleCalendarNavigation = () => {
    if (hasHallRole && !hasAdminOrEmployeeRole) {
      // Hall role stays on current hall view
      navigate(isAdminPath ? `/admin/halls/${hallId || '1'}` : `/halls/${hallId || '1'}`);
    } else {
      // Admin/employee goes to main calendar
      navigate(isAdminPath ? '/admin' : '/admin');
    }
  };

  const handleProtocolsNavigation = () => {
    setShowProtocolsList(true);
  };

  const handleLogout = async () => {
    await signOut();
  };

  // Prevent navigation away - capture back button and history manipulation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Push the current state back to prevent navigation
      window.history.pushState(null, '', window.location.pathname);
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Push initial state to prevent back navigation
    window.history.pushState(null, '', window.location.pathname);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Get user's instance ID
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

      // Support employee role access to halls
      const employeeRole = rolesData.find(r => r.role === 'employee' && r.instance_id);
      if (employeeRole?.instance_id) {
        setInstanceId(employeeRole.instance_id);
        return;
      }

      // Support hall role access (kiosk mode)
      const hallRole = rolesData.find(r => r.role === 'hall' && r.instance_id);
      if (hallRole?.instance_id) {
        setInstanceId(hallRole.instance_id);
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

  // Fetch hall config - supports both UUID and numeric order (1, 2, 3...)
  useEffect(() => {
    const fetchHall = async () => {
      if (!hallId || !instanceId) {
        return;
      }

      let hallData = null;

      // Check if hallId is a number (order-based lookup)
      const hallNumber = parseInt(hallId, 10);
      const isNumeric = !isNaN(hallNumber) && hallNumber > 0;

      if (isNumeric) {
        // Fetch active halls ordered by sort_order and get the Nth one
        const { data: hallsData, error } = await supabase
          .from('halls')
          .select('*')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (!error && hallsData && hallsData.length >= hallNumber) {
          hallData = hallsData[hallNumber - 1]; // 1-indexed
        } else if (!error && hallsData && hallsData.length > 0 && hallNumber === 1) {
          // Fallback: if requesting hall/1 and there's at least one active hall, use it
          hallData = hallsData[0];
        }
      } else {
        // UUID-based lookup
        const { data, error } = await supabase
          .from('halls')
          .select('*')
          .eq('id', hallId)
          .eq('active', true)
          .maybeSingle();

        if (!error) {
          hallData = data;
        }
      }

      if (!hallData) {
        toast.error(t('halls.notFound'));
        navigate(-1);
        return;
      }

      const mappedHall: Hall = {
        id: hallData.id,
        instance_id: hallData.instance_id,
        name: hallData.name,
        slug: hallData.slug,
        station_ids: hallData.station_ids || [],
        visible_fields: (hallData.visible_fields as Hall['visible_fields']) || {
          customer_name: true,
          customer_phone: false,
          vehicle_plate: true,
          services: true,
          admin_notes: false,
        },
        allowed_actions: (hallData.allowed_actions as Hall['allowed_actions']) || {
          add_services: false,
          change_time: false,
          change_station: false,
          edit_reservation: false,
          delete_reservation: false,
        },
        sort_order: hallData.sort_order || 0,
        active: hallData.active,
      };

      setHall(mappedHall);
      // Only set instanceId if it wasn't already set (from user roles)
      if (!instanceId) {
        setInstanceId(hallData.instance_id);
      }
    };

    fetchHall();
  }, [hallId, instanceId, navigate, t]);

  // Fetch data
  useEffect(() => {
    if (!instanceId || !hall) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch stations - filter by hall config
      const { data: stationsData } = await supabase
        .from('stations')
        .select('id, name, type')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .in('id', hall.station_ids.length > 0 ? hall.station_ids : ['__none__'])
        .order('sort_order');

      if (stationsData) {
        setStations(stationsData);
      }

      // Fetch working hours
      const { data: instanceData } = await supabase
        .from('instances')
        .select('working_hours')
        .eq('id', instanceId)
        .maybeSingle();

      if (instanceData?.working_hours) {
        setWorkingHours(instanceData.working_hours as unknown as Record<string, { open: string; close: string } | null>);
      }

      // Fetch reservations
      const { data: reservationsData } = await supabase
        .from('reservations')
        .select(`
          id,
          instance_id,
          customer_name,
          customer_phone,
          vehicle_plate,
          reservation_date,
          end_date,
          start_time,
          end_time,
          station_id,
          status,
          confirmation_code,
          price,
          service_ids,
          service_items,
          has_unified_services,
          stations:station_id (name, type)
        `)
        .eq('instance_id', instanceId);

      if (reservationsData) {
        setReservations(reservationsData.map(r => ({
          ...r,
          status: r.status || 'pending',
          service_ids: Array.isArray(r.service_ids) ? r.service_ids as string[] : undefined,
          service_items: Array.isArray(r.service_items) ? r.service_items as unknown as Array<{ service_id: string; custom_price: number | null }> : undefined,
          service: undefined, // Legacy relation removed
          station: r.stations ? { name: (r.stations as any).name, type: (r.stations as any).type } : undefined,
          has_unified_services: r.has_unified_services,
        })));
      }

      // Fetch breaks
      const { data: breaksData } = await supabase
        .from('breaks')
        .select('*')
        .eq('instance_id', instanceId);

      if (breaksData) {
        setBreaks(breaksData);
      }

      // Fetch yard vehicles count
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { count } = await supabase
        .from('yard_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
        .eq('status', 'waiting')
        .lte('arrival_date', todayStr);

      setYardVehicleCount(count || 0);

      setLoading(false);
    };

    fetchData();
  }, [instanceId, hall]);

  // Subscribe to yard vehicles changes for counter
  useEffect(() => {
    if (!instanceId) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    const fetchYardCount = async () => {
      const { count } = await supabase
        .from('yard_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
        .eq('status', 'waiting')
        .lte('arrival_date', todayStr);
      setYardVehicleCount(count || 0);
    };

    const channel = supabase
      .channel('hall-yard-vehicles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'yard_vehicles',
          filter: `instance_id=eq.${instanceId}`
        },
        () => {
          fetchYardCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  // Play notification sound for new customer reservations
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant notification melody
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (e) {
      console.log('Could not play notification sound:', e);
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!instanceId) return;

    const channel = supabase
      .channel('hall-reservations-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations',
        filter: `instance_id=eq.${instanceId}`
      }, payload => {
        if (payload.eventType === 'INSERT') {
          const newRecord = payload.new as any;
          
          // Play sound only for customer reservations
          if (newRecord.source === 'customer') {
            playNotificationSound();
          }

          supabase
            .from('reservations')
            .select(`
              id,
              instance_id,
              customer_name,
              customer_phone,
              vehicle_plate,
              reservation_date,
              end_date,
              start_time,
              end_time,
              station_id,
              status,
              confirmation_code,
              price,
              source,
              stations:station_id (name, type)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const newReservation = {
                  ...data,
                  status: data.status || 'pending',
                  service: undefined, // Legacy relation removed
                  station: data.stations ? { name: (data.stations as any).name, type: (data.stations as any).type } : undefined
                };
                setReservations(prev => [...prev, newReservation as Reservation]);
                
                const isCustomerReservation = (data as any).source === 'customer';
                toast.success(isCustomerReservation ? `🔔 ${t('notifications.newReservation')}!` : `${t('notifications.newReservation')}!`, {
                  description: `${data.start_time.slice(0, 5)} - ${data.vehicle_plate}`
                });
              }
            });
        } else if (payload.eventType === 'UPDATE') {
          setReservations(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
        } else if (payload.eventType === 'DELETE') {
          setReservations(prev => prev.filter(r => r.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
  };

  const handleStatusChange = (reservationId: string, newStatus: string) => {
    setReservations(prev => prev.map(r => 
      r.id === reservationId ? { ...r, status: newStatus } : r
    ));
  };

  const handleDeleteReservation = async (reservationId: string) => {
    await supabase.from('reservations').delete().eq('id', reservationId);
    setReservations(prev => prev.filter(r => r.id !== reservationId));
    setSelectedReservation(null);
    toast.success(t('reservations.deleted'));
  };

  const handleEditReservation = (reservation: Reservation) => {
    setSelectedReservation(null);
    setEditingReservation(reservation);
  };

  const handleReservationSaved = async () => {
    // Refresh reservations after edit
    const { data: reservationsData } = await supabase
      .from('reservations')
      .select(`
        id,
        instance_id,
        customer_name,
        customer_phone,
        vehicle_plate,
        reservation_date,
        end_date,
        start_time,
        end_time,
        station_id,
        status,
        confirmation_code,
        price,
        service_ids,
        stations:station_id (name, type)
      `)
      .eq('instance_id', instanceId);

    if (reservationsData) {
      setReservations(reservationsData.map(r => ({
        ...r,
        status: r.status || 'pending',
        service_ids: Array.isArray(r.service_ids) ? r.service_ids as string[] : undefined,
        service: undefined, // Legacy relation removed
        station: r.stations ? { name: (r.stations as any).name, type: (r.stations as any).type } : undefined
      })));
    }
    setEditingReservation(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prepare hallConfig for passing to calendar and drawer
  const hallConfig = hall ? {
    visible_fields: hall.visible_fields,
    allowed_actions: hall.allowed_actions,
  } : undefined;

  // Show protocols list in kiosk mode
  if (showProtocolsList && instanceId) {
    return (
      <>
        <Helmet>
          <title>Protokoły | {hall?.name || t('hall.title')}</title>
        </Helmet>
        <ProtocolsView 
          instanceId={instanceId} 
          kioskMode={true}
          onBack={() => setShowProtocolsList(false)}
        />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{hall?.name || t('hall.title')} | {t('hall.employeePanel')}</title>
      </Helmet>

      <div className="h-screen w-screen overflow-hidden bg-background flex">
        {/* Mini Sidebar for hall view */}
        <div className="w-12 h-full bg-sidebar border-r border-border flex flex-col items-center py-4 gap-2 shrink-0">
          {/* Calendar icon */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "w-9 h-9",
              !showProtocolsList && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
            onClick={handleCalendarNavigation}
            title={t('navigation.calendar')}
          >
            <Calendar className="w-5 h-5" />
          </Button>

          {/* Protocols icon */}
          {canAccessProtocols && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-9 h-9",
                showProtocolsList && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onClick={handleProtocolsNavigation}
              title={t('navigation.protocols')}
            >
              <FileText className="w-5 h-5" />
            </Button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Logout button */}
          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            title={t('auth.logout')}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        {/* Main content */}
        <div className="flex-1 h-full overflow-hidden">
          <AdminCalendar
            stations={stations}
            reservations={reservations}
            breaks={breaks}
            workingHours={workingHours}
            onReservationClick={handleReservationClick}
            allowedViews={['day', 'two-days']}
            readOnly={true}
            showStationFilter={false}
            showWeekView={false}
            hallMode={true}
            hallConfig={hallConfig}
            hallDataVisible={hallDataVisible}
            onToggleHallDataVisibility={() => setHallDataVisible(prev => !prev)}
            instanceId={instanceId || undefined}
            yardVehicleCount={yardVehicleCount}
            showProtocolsButton={canAccessProtocols}
            onProtocolsClick={() => setShowProtocolsList(true)}
          />
        </div>
      </div>

      <ReservationDetailsDrawer
        reservation={selectedReservation}
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        mode="hall"
        hallConfig={hallConfig}
        onEdit={hallConfig?.allowed_actions.edit_reservation ? handleEditReservation : undefined}
        onDelete={hallConfig?.allowed_actions.delete_reservation ? (id) => handleDeleteReservation(id) : undefined}
        onStartWork={async (id) => {
          await supabase.from('reservations').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', id);
          handleStatusChange(id, 'in_progress');
        }}
        onEndWork={async (id) => {
          await supabase.from('reservations').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
          handleStatusChange(id, 'completed');
        }}
        onRelease={async (id) => {
          await supabase.from('reservations').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', id);
          handleStatusChange(id, 'released');
        }}
        onRevertToConfirmed={async (id) => {
          await supabase.from('reservations').update({ status: 'confirmed', started_at: null }).eq('id', id);
          handleStatusChange(id, 'confirmed');
        }}
        onRevertToInProgress={async (id) => {
          await supabase.from('reservations').update({ status: 'in_progress', completed_at: null }).eq('id', id);
          handleStatusChange(id, 'in_progress');
        }}
      />

      {/* Edit reservation drawer - only shown when hall allows editing */}
      {editingReservation && instanceId && (
        <AddReservationDialogV2
          open={!!editingReservation}
          onClose={() => setEditingReservation(null)}
          instanceId={instanceId}
          onSuccess={handleReservationSaved}
          editingReservation={{
            id: editingReservation.id,
            customer_name: editingReservation.customer_name,
            customer_phone: editingReservation.customer_phone,
            vehicle_plate: editingReservation.vehicle_plate,
            reservation_date: editingReservation.reservation_date,
            end_date: editingReservation.end_date,
            start_time: editingReservation.start_time,
            end_time: editingReservation.end_time,
            station_id: editingReservation.station_id,
            price: editingReservation.price,
            service_ids: editingReservation.service_ids,
            has_unified_services: editingReservation.has_unified_services,
          }}
        />
      )}
    </>
  );
};

export default HallView;
