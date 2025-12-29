import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Car, Calendar, LogOut, Menu, Clock, CheckCircle2, Settings, Users, UserCircle, PanelLeftClose, PanelLeft, AlertCircle, Check, Filter, FileText, Building2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useInstanceFeatures } from '@/hooks/useInstanceFeatures';
import { supabase } from '@/integrations/supabase/client';
import AdminCalendar from '@/components/admin/AdminCalendar';
import ReservationDetails from '@/components/admin/ReservationDetails';
import AddReservationDialog from '@/components/admin/AddReservationDialog';
import AddBreakDialog from '@/components/admin/AddBreakDialog';
import MobileBottomNav from '@/components/admin/MobileBottomNav';
import PriceListSettings from '@/components/admin/PriceListSettings';
import StationsSettings from '@/components/admin/StationsSettings';
import WorkingHoursSettings from '@/components/admin/WorkingHoursSettings';
import CustomersView from '@/components/admin/CustomersView';
import { SmsUsageCard } from '@/components/admin/SmsUsageCard';
import { ReservationConfirmSettings } from '@/components/admin/ReservationConfirmSettings';
import InstanceSettingsDialog from '@/components/admin/InstanceSettingsDialog';
import { toast } from 'sonner';
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
    shortcut?: string | null;
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
interface ClosedDay {
  id: string;
  instance_id: string;
  closed_date: string;
  reason: string | null;
}
type ViewType = 'calendar' | 'reservations' | 'customers' | 'settings';

const validViews: ViewType[] = ['calendar', 'reservations', 'customers', 'settings'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { view } = useParams<{ view?: string }>();
  const {
    user,
    signOut
  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    return saved === 'true';
  });
  
  // Derive currentView from URL param
  const currentView: ViewType = view && validViews.includes(view as ViewType) 
    ? (view as ViewType) 
    : 'calendar';
  
  const setCurrentView = (newView: ViewType) => {
    if (newView === 'calendar') {
      navigate('/admin');
    } else {
      navigate(`/admin/${newView}`);
    }
  };
  
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stations, setStations] = useState<Station[]>([]);

  // Add reservation dialog state
  const [addReservationOpen, setAddReservationOpen] = useState(false);
  const [newReservationData, setNewReservationData] = useState({
    stationId: '',
    date: '',
    time: '',
    stationType: '' as string
  });

  // Breaks state
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [addBreakOpen, setAddBreakOpen] = useState(false);
  const [newBreakData, setNewBreakData] = useState({
    stationId: '',
    date: '',
    time: ''
  });
  
  // Closed days state
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([]);

  // Reservation list filter
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  // Get user's instance ID from user_roles
  const [instanceId, setInstanceId] = useState<string | null>(null);

  // Instance settings dialog
  const [instanceSettingsOpen, setInstanceSettingsOpen] = useState(false);
  const [instanceData, setInstanceData] = useState<any>(null);

  // Instance features
  const { hasFeature } = useInstanceFeatures(instanceId);

  // Working hours for calendar
  const [workingHours, setWorkingHours] = useState<Record<string, {
    open: string;
    close: string;
  } | null> | null>(null);
  useEffect(() => {
    const fetchUserInstanceId = async () => {
      if (!user) return;

      // Get all user roles
      const {
        data: rolesData
      } = await supabase.from('user_roles').select('instance_id, role').eq('user_id', user.id);
      if (!rolesData || rolesData.length === 0) return;

      // First check if user has admin role with instance_id
      const adminRole = rolesData.find(r => r.role === 'admin' && r.instance_id);
      if (adminRole?.instance_id) {
        setInstanceId(adminRole.instance_id);
        return;
      }

      // Check for super_admin - get first available instance
      const isSuperAdmin = rolesData.some(r => r.role === 'super_admin');
      if (isSuperAdmin) {
        const {
          data: instances
        } = await supabase.from('instances').select('id').eq('active', true).limit(1).maybeSingle();
        if (instances?.id) {
          setInstanceId(instances.id);
        }
      }
    };
    fetchUserInstanceId();
  }, [user]);

  // Fetch stations from database
  const fetchStations = async () => {
    if (!instanceId) return;
    const {
      data,
      error
    } = await supabase.from('stations').select('id, name, type').eq('instance_id', instanceId).eq('active', true).order('sort_order');
    if (!error && data) {
      setStations(data);
    }
  };

  // Fetch working hours from database
  const fetchWorkingHours = async () => {
    if (!instanceId) return;
    const {
      data
    } = await supabase.from('instances').select('working_hours').eq('id', instanceId).maybeSingle();
    if (data?.working_hours) {
      setWorkingHours(data.working_hours as unknown as Record<string, {
        open: string;
        close: string;
      } | null>);
    }
  };

  // Fetch instance data for settings
  const fetchInstanceData = async () => {
    if (!instanceId) return;
    const { data } = await supabase
      .from('instances')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle();
    if (data) {
      setInstanceData(data);
    }
  };

  useEffect(() => {
    fetchStations();
    fetchWorkingHours();
    fetchInstanceData();
  }, [instanceId]);

  // Save sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Refetch stations when switching to calendar view
  useEffect(() => {
    if (currentView === 'calendar') {
      fetchStations();
      fetchReservations();
      fetchBreaks();
      fetchClosedDays();
    }
  }, [currentView]);

  // Fetch reservations from database
  const fetchReservations = async () => {
    if (!instanceId) return;
    const {
      data,
      error
    } = await supabase.from('reservations').select(`
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
        services:service_id (name, shortcut),
        stations:station_id (name, type)
      `).eq('instance_id', instanceId);
    if (!error && data) {
      setReservations(data.map(r => ({
        ...r,
        status: r.status || 'pending',
        service: r.services ? {
          name: (r.services as any).name,
          shortcut: (r.services as any).shortcut
        } : undefined,
        station: r.stations ? {
          name: (r.stations as any).name,
          type: (r.stations as any).type
        } : undefined
      })));
    }
  };

  // Fetch breaks from database
  const fetchBreaks = async () => {
    if (!instanceId) return;
    const {
      data,
      error
    } = await supabase.from('breaks').select('*').eq('instance_id', instanceId);
    if (!error && data) {
      setBreaks(data);
    }
  };
  
  // Fetch closed days from database
  const fetchClosedDays = async () => {
    if (!instanceId) return;
    const { data, error } = await supabase
      .from('closed_days')
      .select('*')
      .eq('instance_id', instanceId);
    if (!error && data) {
      setClosedDays(data);
    }
  };
  
  useEffect(() => {
    fetchReservations();
    fetchBreaks();
    fetchClosedDays();
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

  // Subscribe to realtime updates for reservations
  useEffect(() => {
    if (!instanceId) return;
    const channel = supabase.channel('reservations-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reservations',
      filter: `instance_id=eq.${instanceId}`
    }, payload => {
      console.log('Realtime reservation update:', payload);
      if (payload.eventType === 'INSERT') {
        const newRecord = payload.new as any;
        
        // Play sound only for customer reservations
        if (newRecord.source === 'customer') {
          playNotificationSound();
        }
        
        // Fetch the new reservation with service and station info
        supabase.from('reservations').select(`
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
                services:service_id (name, shortcut),
                stations:station_id (name, type)
              `).eq('id', payload.new.id).single().then(({
          data
        }) => {
          if (data) {
            const newReservation = {
              ...data,
              status: data.status || 'pending',
              service: data.services ? {
                name: (data.services as any).name,
                shortcut: (data.services as any).shortcut
              } : undefined,
              station: data.stations ? {
                name: (data.stations as any).name,
                type: (data.stations as any).type
              } : undefined
            };
            setReservations(prev => [...prev, newReservation as Reservation]);
            
            const isCustomerReservation = (data as any).source === 'customer';
            toast.success(isCustomerReservation ? '🔔 Nowa rezerwacja od klienta!' : 'Nowa rezerwacja!', {
              description: `${data.customer_name} - ${data.start_time}`
            });
          }
        });
      } else if (payload.eventType === 'UPDATE') {
        setReservations(prev => prev.map(r => r.id === payload.new.id ? {
          ...r,
          ...payload.new
        } : r));
      } else if (payload.eventType === 'DELETE') {
        setReservations(prev => prev.filter(r => r.id !== payload.old.id));
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  // Calculate free time ranges (gaps) per station
  const getFreeRangesPerStation = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinutes;
    const today = format(now, 'yyyy-MM-dd');

    // Working hours 8:00 - 18:00
    const workStart = 8 * 60; // 8:00 in minutes
    const workEnd = 18 * 60; // 18:00 in minutes

    return stations.map(station => {
      const stationReservations = reservations.filter(r => r.station_id === station.id && r.reservation_date === today).map(r => ({
        start: parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]),
        end: parseInt(r.end_time.split(':')[0]) * 60 + parseInt(r.end_time.split(':')[1])
      })).sort((a, b) => a.start - b.start);

      // Find gaps
      const gaps: {
        start: number;
        end: number;
      }[] = [];
      let searchStart = Math.max(workStart, currentTimeMinutes);
      for (const res of stationReservations) {
        if (res.start > searchStart) {
          gaps.push({
            start: searchStart,
            end: res.start
          });
        }
        searchStart = Math.max(searchStart, res.end);
      }

      // Add gap at the end if there's time left
      if (searchStart < workEnd) {
        gaps.push({
          start: searchStart,
          end: workEnd
        });
      }

      // Format gaps as readable strings
      const freeRanges = gaps.map(gap => {
        const startHour = Math.floor(gap.start / 60);
        const startMin = gap.start % 60;
        const endHour = Math.floor(gap.end / 60);
        const endMin = gap.end % 60;
        const durationHours = (gap.end - gap.start) / 60;
        const startStr = `${startHour}:${startMin.toString().padStart(2, '0')}`;
        const endStr = `${endHour}:${endMin.toString().padStart(2, '0')}`;
        const durationStr = durationHours >= 1 ? `${Math.floor(durationHours)}h${durationHours % 1 > 0 ? ` ${Math.round(durationHours % 1 * 60)}min` : ''}` : `${Math.round(durationHours * 60)}min`;
        return {
          label: `${startStr} - ${endStr}`,
          duration: durationStr,
          durationMinutes: gap.end - gap.start
        };
      });
      return {
        ...station,
        freeRanges
      };
    });
  };
  const stationsWithRanges = getFreeRangesPerStation();
  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };
  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
  };
  const handleDeleteReservation = async (reservationId: string, customerData: {
    name: string;
    phone: string;
    email?: string;
    instance_id: string;
  }) => {
    try {
      // First, save the customer to customers table (upsert by phone)
      const {
        error: customerError
      } = await supabase.from('customers').upsert({
        instance_id: customerData.instance_id,
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email
      }, {
        onConflict: 'instance_id,phone',
        ignoreDuplicates: false
      });
      if (customerError) {
        console.error('Error saving customer:', customerError);
        // Continue with deletion even if customer save fails
      }

      // Delete the reservation from database
      const {
        error: deleteError
      } = await supabase.from('reservations').delete().eq('id', reservationId);
      if (deleteError) {
        toast.error('Błąd podczas usuwania rezerwacji');
        console.error('Error deleting reservation:', deleteError);
        return;
      }

      // Remove from local state
      setReservations(prev => prev.filter(r => r.id !== reservationId));
      setSelectedReservation(null);
      toast.success('Rezerwacja została anulowana, dane klienta zachowane');
    } catch (error) {
      console.error('Error in delete operation:', error);
      toast.error('Wystąpił błąd');
    }
  };
  const handleReservationSave = (reservationId: string, data: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      ...data
    } : r));
    setSelectedReservation(null);
    toast.success('Rezerwacja została zaktualizowana');
  };
  const handleAddReservation = (stationId: string, date: string, time: string) => {
    const station = stations.find(s => s.id === stationId);
    setNewReservationData({
      stationId,
      date,
      time,
      stationType: station?.type || ''
    });
    setAddReservationOpen(true);
  };

  // Quick add reservation (for mobile bottom nav)
  const handleQuickAddReservation = () => {
    const firstStation = stations[0];
    const now = new Date();
    const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
    now.setMinutes(roundedMinutes, 0, 0);
    if (roundedMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    }
    const timeStr = format(now, 'HH:mm');
    
    setNewReservationData({
      stationId: firstStation?.id || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: timeStr,
      stationType: firstStation?.type || ''
    });
    setAddReservationOpen(true);
  };
  const handleReservationAdded = () => {
    // Refresh reservations from database
    fetchReservations();
    toast.success('Rezerwacja została dodana');
  };
  const handleAddBreak = (stationId: string, date: string, time: string) => {
    setNewBreakData({
      stationId,
      date,
      time
    });
    setAddBreakOpen(true);
  };
  const handleBreakAdded = () => {
    fetchBreaks();
  };
  const handleDeleteBreak = async (breakId: string) => {
    // Optimistic update - remove from UI immediately
    setBreaks(prev => prev.filter(b => b.id !== breakId));
    
    const { error } = await supabase.from('breaks').delete().eq('id', breakId);
    if (error) {
      toast.error('Błąd podczas usuwania przerwy');
      console.error('Error deleting break:', error);
      // Revert on error - refetch breaks
      fetchBreaks();
      return;
    }
    toast.success('Przerwa została usunięta');
  };
  
  const handleToggleClosedDay = async (date: string) => {
    if (!instanceId) return;
    
    const existingClosedDay = closedDays.find(cd => cd.closed_date === date);
    
    if (existingClosedDay) {
      // Day is closed - open it (delete from closed_days)
      setClosedDays(prev => prev.filter(cd => cd.id !== existingClosedDay.id));
      
      const { error } = await supabase
        .from('closed_days')
        .delete()
        .eq('id', existingClosedDay.id);
      
      if (error) {
        toast.error('Błąd podczas otwierania dnia');
        console.error('Error opening day:', error);
        fetchClosedDays();
        return;
      }
      toast.success('Dzień został otwarty');
    } else {
      // Day is open - close it (insert to closed_days)
      const newClosedDay = {
        instance_id: instanceId,
        closed_date: date,
        reason: null
      };
      
      const { data, error } = await supabase
        .from('closed_days')
        .insert(newClosedDay)
        .select()
        .single();
      
      if (error) {
        toast.error('Błąd podczas zamykania dnia');
        console.error('Error closing day:', error);
        return;
      }
      
      if (data) {
        setClosedDays(prev => [...prev, data]);
      }
      toast.success('Dzień został zamknięty');
    }
  };

  const handleConfirmReservation = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'confirmed' })
      .eq('id', reservationId);
    
    if (error) {
      toast.error('Błąd podczas potwierdzania rezerwacji');
      console.error('Error confirming reservation:', error);
      return;
    }
    
    // Update local state
    setReservations(prev => prev.map(r => 
      r.id === reservationId ? { ...r, status: 'confirmed' } : r
    ));
    
    // Send confirmation SMS
    try {
      const dateObj = new Date(reservation.reservation_date);
      const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
      const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
      const dayName = dayNames[dateObj.getDay()];
      const dayNum = dateObj.getDate();
      const monthName = monthNames[dateObj.getMonth()];
      
      const message = `Twoja rezerwacja została potwierdzona! ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthName} o ${reservation.start_time?.slice(0, 5)}-${reservation.end_time?.slice(0, 5)}. Do zobaczenia!`;
      
      await supabase.functions.invoke('send-sms-message', {
        body: {
          phone: reservation.customer_phone,
          message,
          instanceId
        }
      });
      
      toast.success('Rezerwacja potwierdzona, SMS wysłany do klienta');
    } catch (smsError) {
      console.error('Failed to send confirmation SMS:', smsError);
      toast.success('Rezerwacja potwierdzona (SMS nieudany)');
    }
  };
  const handleReservationMove = async (reservationId: string, newStationId: string, newDate: string, newTime?: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    // Store original state for undo
    const originalState = {
      station_id: reservation.station_id,
      reservation_date: reservation.reservation_date,
      start_time: reservation.start_time,
      end_time: reservation.end_time
    };
    
    const updates: any = {
      station_id: newStationId,
      reservation_date: newDate
    };
    if (newTime) {
      // Calculate new end time based on duration
      const [startHours, startMinutes] = newTime.split(':').map(Number);
      const [endHours, endMinutes] = reservation.end_time.split(':').map(Number);
      const [origStartHours, origStartMinutes] = reservation.start_time.split(':').map(Number);
      const durationMinutes = endHours * 60 + endMinutes - (origStartHours * 60 + origStartMinutes);
      const newEndTotalMinutes = startHours * 60 + startMinutes + durationMinutes;
      const newEndHours = Math.floor(newEndTotalMinutes / 60);
      const newEndMins = newEndTotalMinutes % 60;
      updates.start_time = newTime;
      updates.end_time = `${newEndHours.toString().padStart(2, '0')}:${newEndMins.toString().padStart(2, '0')}`;
    }

    // Update in database
    const {
      error
    } = await supabase.from('reservations').update(updates).eq('id', reservationId);
    if (error) {
      toast.error('Błąd podczas przenoszenia rezerwacji');
      console.error('Error moving reservation:', error);
      return;
    }

    // Update local state
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      ...updates
    } : r));
    
    const station = stations.find(s => s.id === newStationId);
    const dateChanged = reservation.reservation_date !== newDate;
    const message = dateChanged 
      ? `Rezerwacja przeniesiona na ${station?.name || 'stanowisko'} (${newDate})`
      : `Rezerwacja przeniesiona na ${station?.name || 'nowe stanowisko'}`;
    
    // Show toast with undo action
    toast.success(message, {
      duration: 5000,
      action: {
        label: 'Cofnij',
        onClick: async () => {
          // Restore original state in database
          const { error: undoError } = await supabase
            .from('reservations')
            .update(originalState)
            .eq('id', reservationId);
          
          if (undoError) {
            toast.error('Błąd podczas cofania zmiany');
            console.error('Error undoing move:', undoError);
            return;
          }
          
          // Restore local state
          setReservations(prev => prev.map(r => r.id === reservationId ? {
            ...r,
            ...originalState
          } : r));
          
          toast.success('Zmiana została cofnięta');
        }
      }
    });
  };
  return <>
      <Helmet>
        <title>Panel Admina - ARM CAR AUTO SPA</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={cn("fixed lg:static inset-y-0 left-0 z-50 bg-card border-r border-border/50 transition-all duration-300", sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0", sidebarCollapsed ? "lg:w-16" : "w-64")}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={cn("border-b border-border/50 flex items-center", sidebarCollapsed ? "p-3 justify-center" : "p-6")}>
              <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shrink-0">
                  <Car className="w-5 h-5 text-primary-foreground" />
                </div>
                {!sidebarCollapsed && <div>
                    <h1 className="font-bold text-foreground">ARM CAR</h1>
                    <p className="text-xs text-muted-foreground">Panel Admina</p>
                  </div>}
              </div>
            </div>

            {/* Navigation */}
            <nav className={cn("flex-1 space-y-2", sidebarCollapsed ? "p-2" : "p-4")}>
              <Button variant={currentView === 'calendar' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => setCurrentView('calendar')} title="Kalendarz">
                <Calendar className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Kalendarz"}
              </Button>
              <Button variant={currentView === 'reservations' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => setCurrentView('reservations')} title="Rezerwacje">
                <Users className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Rezerwacje"}
              </Button>
              <Button variant={currentView === 'customers' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => setCurrentView('customers')} title="Klienci">
                <UserCircle className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Klienci"}
              </Button>
              {hasFeature('offers') && (
                <Button variant="ghost" className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => navigate('/admin/oferty')} title="Oferty">
                  <FileText className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Oferty"}
                </Button>
              )}
              {hasFeature('followup') && (
                <Button variant="ghost" className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => navigate('/admin/followup')} title="Follow-up">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Follow-up"}
                </Button>
              )}
              <Button variant={currentView === 'settings' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => setCurrentView('settings')} title="Ustawienia">
                <Settings className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Ustawienia"}
              </Button>
            </nav>

            {/* Collapse toggle & User Info & Logout */}
            <div className={cn("border-t border-border/50 space-y-2", sidebarCollapsed ? "p-2" : "p-4")}>
              {/* Collapse button - desktop only */}
              <Button variant="ghost" className={cn("w-full text-muted-foreground hidden lg:flex gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Rozwiń menu" : "Zwiń menu"}>
                {sidebarCollapsed ? <PanelLeft className="w-4 h-4 shrink-0" /> : <>
                    <PanelLeftClose className="w-4 h-4 shrink-0" />
                    Zwiń menu
                  </>}
              </Button>
              
              {!sidebarCollapsed && user && <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                  {user.email}
                </div>}
              <Button variant="ghost" className={cn("w-full text-muted-foreground gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={handleLogout} title="Wyloguj się">
                <LogOut className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Wyloguj się"}
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 glass-card border-b border-border/50 p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                <span className="font-bold">ARM CAR</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto pb-20 lg:pb-8">
            {/* Header - only shown for non-calendar views */}
            {currentView !== 'calendar' && (
              <h1 className="text-2xl font-bold text-foreground">
                {currentView === 'reservations' ? 'Lista rezerwacji' : currentView === 'customers' ? 'Klienci' : 'Ustawienia'}
              </h1>
            )}

            {/* Free Time Ranges Per Station - Hidden on desktop, shown via bottom sheet on mobile */}

            {/* View Content */}
            {currentView === 'calendar' && <div className="flex-1 min-h-[600px]">
                <AdminCalendar stations={stations} reservations={reservations} breaks={breaks} closedDays={closedDays} workingHours={workingHours} onReservationClick={handleReservationClick} onAddReservation={handleAddReservation} onAddBreak={handleAddBreak} onDeleteBreak={handleDeleteBreak} onToggleClosedDay={handleToggleClosedDay} onReservationMove={handleReservationMove} onConfirmReservation={handleConfirmReservation} />
              </div>}

            {currentView === 'reservations' && <div className="space-y-4">
                {/* Filter controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={showPendingOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowPendingOnly(!showPendingOnly)}
                    className="gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Do potwierdzenia
                    {reservations.filter(r => r.status === 'pending').length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                        {reservations.filter(r => r.status === 'pending').length}
                      </span>
                    )}
                  </Button>
                </div>

                <div className="glass-card overflow-hidden">
                  <div className="divide-y divide-border/50">
                    {reservations
                      .filter(r => !showPendingOnly || r.status === 'pending')
                      .sort((a, b) => {
                        // Pending first, then by date
                        if (a.status === 'pending' && b.status !== 'pending') return -1;
                        if (a.status !== 'pending' && b.status === 'pending') return 1;
                        return new Date(a.reservation_date).getTime() - new Date(b.reservation_date).getTime();
                      })
                      .map(reservation => {
                        const isPending = reservation.status === 'pending';
                        return (
                          <div key={reservation.id} onClick={() => handleReservationClick(reservation)} className={cn(
                            "p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer",
                            isPending ? "bg-amber-500/10" : "bg-primary-foreground"
                          )}>
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                isPending ? "bg-amber-500/20 text-amber-600" : "bg-success/10 text-success"
                              )}>
                                {isPending ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate">
                                  {reservation.vehicle_plate}
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {reservation.service?.name} • {reservation.customer_name}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {isPending && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmReservation(reservation.id);
                                  }}
                                >
                                  <Check className="w-4 h-4" />
                                  Potwierdź
                                </Button>
                              )}
                              <div className="text-right shrink-0">
                                <div className="font-medium text-foreground">
                                  {reservation.start_time?.slice(0, 5)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(reservation.reservation_date), 'd MMM', { locale: pl })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>}

            {currentView === 'customers' && <CustomersView instanceId={instanceId} />}

            {currentView === 'settings' && <div className="space-y-6">

                {/* Company Settings Button */}
                {instanceData && (
                  <div className="glass-card p-6 bg-secondary-foreground">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          Dane firmy i branding
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Logo, kolory, dane kontaktowe
                        </p>
                      </div>
                      <Button onClick={() => setInstanceSettingsOpen(true)}>
                        Edytuj
                      </Button>
                    </div>
                  </div>
                )}

                {instanceId && (
                  <SmsUsageCard instanceId={instanceId} />
                )}

                {/* Reservation Confirm Settings */}
                <div className="glass-card p-6 bg-secondary-foreground">
                  <ReservationConfirmSettings instanceId={instanceId} />
                </div>
                
                <div className="glass-card p-6 bg-secondary-foreground">
                  <WorkingHoursSettings instanceId={instanceId} />
                </div>
                
                <div className="glass-card p-6 bg-secondary-foreground">
                  <StationsSettings instanceId={instanceId} />
                </div>
                
                <div className="glass-card p-6 bg-secondary-foreground">
                  <PriceListSettings instanceId={instanceId} />
                </div>
              </div>}
          </div>
        </main>
      </div>

      {/* Reservation Details Modal */}
      <ReservationDetails 
        reservation={selectedReservation} 
        open={!!selectedReservation} 
        onClose={() => setSelectedReservation(null)} 
        onDelete={handleDeleteReservation} 
        onSave={handleReservationSave}
        onConfirm={async (id) => {
          await handleConfirmReservation(id);
          setSelectedReservation(null);
        }}
      />

      {/* Add Reservation Dialog */}
      {instanceId && <AddReservationDialog open={addReservationOpen} onClose={() => setAddReservationOpen(false)} stationId={newReservationData.stationId} stationType={newReservationData.stationType} date={newReservationData.date} time={newReservationData.time} instanceId={instanceId} onSuccess={handleReservationAdded} existingReservations={reservations} existingBreaks={breaks} workingHours={workingHours} />}

      {/* Add Break Dialog */}
      {instanceId && <AddBreakDialog open={addBreakOpen} onOpenChange={setAddBreakOpen} instanceId={instanceId} stations={stations} initialData={newBreakData} onBreakAdded={handleBreakAdded} />}

      {/* Instance Settings Dialog */}
      <InstanceSettingsDialog 
        open={instanceSettingsOpen}
        onOpenChange={setInstanceSettingsOpen}
        instance={instanceData}
        onUpdate={(updated) => {
          setInstanceData(updated);
        }}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        stations={stations} 
        reservations={reservations} 
        currentDate={format(new Date(), 'yyyy-MM-dd')}
        onAddReservation={handleQuickAddReservation}
      />
    </>;
};
export default AdminDashboard;