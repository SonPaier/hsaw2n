import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AdminCalendar from '@/components/admin/AdminCalendar';
import HallReservationDetails from '@/components/admin/HallReservationDetails';
import { Loader2 } from 'lucide-react';

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
  service?: {
    name: string;
  };
  station?: {
    name: string;
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
  price: number | null;
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

const HallView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [workingHours, setWorkingHours] = useState<Record<string, { open: string; close: string } | null> | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent navigation away - capture back button and history manipulation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Push the current state back to prevent navigation
      window.history.pushState(null, '', '/admin/hall');
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Push initial state to prevent back navigation
    window.history.pushState(null, '', '/admin/hall');

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

  // Fetch data
  useEffect(() => {
    if (!instanceId) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch stations
      const { data: stationsData } = await supabase
        .from('stations')
        .select('id, name, type')
        .eq('instance_id', instanceId)
        .eq('active', true)
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
          services:service_id (name),
          stations:station_id (name, type)
        `)
        .eq('instance_id', instanceId);

      if (reservationsData) {
        setReservations(reservationsData.map(r => ({
          ...r,
          status: r.status || 'pending',
          service: r.services ? { name: (r.services as any).name } : undefined,
          station: r.stations ? { name: (r.stations as any).name, type: (r.stations as any).type } : undefined
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

      setLoading(false);
    };

    fetchData();
  }, [instanceId]);

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
              services:service_id (name),
              stations:station_id (name, type)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const newReservation = {
                  ...data,
                  status: data.status || 'pending',
                  service: data.services ? { name: (data.services as any).name } : undefined,
                  station: data.stations ? { name: (data.stations as any).name, type: (data.stations as any).type } : undefined
                };
                setReservations(prev => [...prev, newReservation as Reservation]);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Widok hali | Panel pracownika</title>
      </Helmet>

      <div className="h-screen w-screen overflow-hidden bg-background">
        <AdminCalendar
          stations={stations.filter(s => s.type === 'washing')}
          reservations={reservations}
          breaks={breaks}
          workingHours={workingHours}
          onReservationClick={handleReservationClick}
          allowedViews={['day', 'two-days']}
          readOnly={true}
          showStationFilter={false}
          showWeekView={false}
          hallMode={true}
        />
      </div>

      <HallReservationDetails
        reservation={selectedReservation}
        open={!!selectedReservation}
        onOpenChange={(open) => !open && setSelectedReservation(null)}
        onStatusChange={handleStatusChange}
      />
    </>
  );
};

export default HallView;
