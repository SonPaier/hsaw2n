import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Car, Calendar, LogOut, Menu, CheckCircle, Settings, Users, UserCircle, PanelLeftClose, PanelLeft, FileText, CalendarClock, ChevronUp, Package, Bell } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useInstanceFeatures } from '@/hooks/useInstanceFeatures';
import { supabase } from '@/integrations/supabase/client';
import AdminCalendar from '@/components/admin/AdminCalendar';
import ReservationDetailsDrawer from '@/components/admin/ReservationDetailsDrawer';
import ReservationsView from '@/components/admin/ReservationsView';
import AddReservationDialogV2 from '@/components/admin/AddReservationDialogV2';
import AddBreakDialog from '@/components/admin/AddBreakDialog';
import MobileBottomNav from '@/components/admin/MobileBottomNav';
import CustomersView from '@/components/admin/CustomersView';
import InstanceSettingsDialog from '@/components/admin/InstanceSettingsDialog';
import OffersView from '@/components/admin/OffersView';
import ProductsView from '@/components/admin/ProductsView';
import FollowUpView from '@/components/admin/FollowUpView';
import NotificationsView from '@/components/admin/NotificationsView';
import SettingsView from '@/components/admin/SettingsView';
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
  // Array of all services (if multi-service reservation)
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
type ViewType = 'calendar' | 'reservations' | 'customers' | 'settings' | 'offers' | 'products' | 'followup' | 'notifications';
const validViews: ViewType[] = ['calendar', 'reservations', 'customers', 'settings', 'offers', 'products', 'followup', 'notifications'];
const AdminDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    view
  } = useParams<{
    view?: string;
  }>();
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
  const currentView: ViewType = view && validViews.includes(view as ViewType) ? view as ViewType : 'calendar';
  const setCurrentView = (newView: ViewType) => {
    if (newView === 'calendar') {
      navigate('/admin');
    } else {
      navigate(`/admin/${newView}`);
    }
  };
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allServices, setAllServices] = useState<Array<{
    id: string;
    name: string;
    shortcut?: string | null;
    duration_minutes?: number | null;
    duration_small?: number | null;
    duration_medium?: number | null;
    duration_large?: number | null;
  }>>([]);
  const [stations, setStations] = useState<Station[]>([]);

  // Add/Edit reservation dialog state
  const [addReservationOpen, setAddReservationOpen] = useState(false);
  const [addReservationV2Open, setAddReservationV2Open] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
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

  // Yard vehicle count for badge
  const [yardVehicleCount, setYardVehicleCount] = useState(0);

  // Unread notifications count for badge
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Reservation list filter
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  // Get user's instance ID from user_roles
  const [instanceId, setInstanceId] = useState<string | null>(null);

  // Instance settings dialog
  const [instanceSettingsOpen, setInstanceSettingsOpen] = useState(false);
  const [instanceData, setInstanceData] = useState<any>(null);

  // Instance features
  const {
    hasFeature
  } = useInstanceFeatures(instanceId);

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
    const {
      data
    } = await supabase.from('instances').select('*').eq('id', instanceId).maybeSingle();
    if (data) {
      setInstanceData(data);
    }
  };

  // Fetch yard vehicle count for badge
  const fetchYardVehicleCount = async () => {
    if (!instanceId) return;
    const { count, error } = await supabase
      .from('yard_vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('instance_id', instanceId)
      .eq('status', 'waiting');
    if (!error && count !== null) {
      setYardVehicleCount(count);
    }
  };

  // Fetch unread notifications count for badge
  const fetchUnreadNotificationsCount = async () => {
    if (!instanceId) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('instance_id', instanceId)
      .eq('read', false);
    if (!error && count !== null) {
      setUnreadNotificationsCount(count);
    }
  };

  useEffect(() => {
    fetchStations();
    fetchWorkingHours();
    fetchInstanceData();
    fetchYardVehicleCount();
    fetchUnreadNotificationsCount();
  }, [instanceId]);

  // Subscribe to yard_vehicles changes for real-time count updates
  useEffect(() => {
    if (!instanceId) return;
    
    const channel = supabase
      .channel('yard-count-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'yard_vehicles',
          filter: `instance_id=eq.${instanceId}`
        },
        () => {
          fetchYardVehicleCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  // Subscribe to notifications changes for real-time count updates
  useEffect(() => {
    if (!instanceId) return;
    
    const channel = supabase
      .channel('notifications-count-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `instance_id=eq.${instanceId}`
        },
        () => {
          fetchUnreadNotificationsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // Fetch all services for multi-service mapping
  const fetchAllServices = async () => {
    if (!instanceId) return;
    const {
      data
    } = await supabase.from('services').select('id, name, shortcut, duration_minutes, duration_small, duration_medium, duration_large').eq('instance_id', instanceId).eq('active', true);
    if (data) {
      setAllServices(data);
    }
  };

  // Fetch reservations from database
  const fetchReservations = async () => {
    if (!instanceId) return;

    // First fetch services to map service_ids
    const {
      data: servicesData
    } = await supabase.from('services').select('id, name, shortcut').eq('instance_id', instanceId).eq('active', true);
    const servicesMap = new Map<string, {
      name: string;
      shortcut?: string | null;
    }>();
    if (servicesData) {
      servicesData.forEach(s => servicesMap.set(s.id, {
        name: s.name,
        shortcut: s.shortcut
      }));
    }
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
        notes,
        source,
        car_size,
        service_ids,
        services:service_id (name, shortcut),
        stations:station_id (name, type)
      `).eq('instance_id', instanceId);
    if (!error && data) {
      setReservations(data.map(r => {
        // Map service_ids to services_data if available
        const serviceIds = (r as any).service_ids as string[] | null;
        const servicesData: Array<{
          name: string;
          shortcut?: string | null;
        }> = [];
        if (serviceIds && serviceIds.length > 0) {
          serviceIds.forEach(id => {
            const svc = servicesMap.get(id);
            if (svc) servicesData.push(svc);
          });
        }
        return {
          ...r,
          status: r.status || 'pending',
          service: r.services ? {
            name: (r.services as any).name,
            shortcut: (r.services as any).shortcut
          } : undefined,
          services_data: servicesData.length > 0 ? servicesData : undefined,
          station: r.stations ? {
            name: (r.stations as any).name,
            type: (r.stations as any).type
          } : undefined
        };
      }));
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
    const {
      data,
      error
    } = await supabase.from('closed_days').select('*').eq('instance_id', instanceId);
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
            // Only show toast for customer-created reservations (admin-created reservations show toast in dialog)
            const isCustomerReservation = (data as any).source === 'customer';
            if (isCustomerReservation) {
              toast.success('🔔 Nowa rezerwacja od klienta!', {
                description: `${data.customer_name} - ${data.start_time}`
              });
            }
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
        toast.error(t('errors.generic'));
        console.error('Error deleting reservation:', deleteError);
        return;
      }

      // Remove from local state
      setReservations(prev => prev.filter(r => r.id !== reservationId));
      setSelectedReservation(null);
      toast.success(t('reservations.reservationRejected'));
    } catch (error) {
      console.error('Error in delete operation:', error);
      toast.error(t('errors.generic'));
    }
  };
  
  // Reject reservation - soft delete with undo option
  const handleRejectReservation = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation || !instanceId) return;

    // Immediately hide from UI
    setReservations(prev => prev.filter(r => r.id !== reservationId));

    // Store timeout ID so we can cancel if user clicks Cofnij
    let deleteExecuted = false;

    const executeDelete = async () => {
      if (deleteExecuted) return;
      deleteExecuted = true;
      
      try {
        // Save customer data before deleting
        await supabase.from('customers').upsert({
          instance_id: instanceId,
          name: reservation.customer_name,
          phone: reservation.customer_phone,
          source: 'myjnia',
        }, {
          onConflict: 'instance_id,source,phone',
          ignoreDuplicates: false
        });

        const { error } = await supabase.from('reservations').delete().eq('id', reservationId);
        if (error) {
          console.error('Error rejecting reservation:', error);
          // Restore if delete failed
          setReservations(prev => [...prev, reservation]);
          toast.error(t('errors.generic'));
        }
      } catch (error) {
        console.error('Error rejecting reservation:', error);
        setReservations(prev => [...prev, reservation]);
        toast.error(t('errors.generic'));
      }
    };

    // Show toast with undo option - delete happens when toast disappears
    toast(t('reservations.reservationRejected'), {
      action: {
        label: t('common.undo'),
        onClick: () => {
          deleteExecuted = true; // Prevent delete
          setReservations(prev => [...prev, reservation]);
          toast.success(t('common.success'));
        },
      },
      duration: 5000,
      onDismiss: () => {
        executeDelete();
      },
      onAutoClose: () => {
        executeDelete();
      },
    });
  };
  const handleReservationSave = (reservationId: string, data: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      ...data
    } : r));
    setSelectedReservation(null);
    toast.success(t('reservations.reservationUpdated'));
  };
  const handleAddReservation = (stationId: string, date: string, time: string) => {
    const station = stations.find(s => s.id === stationId);
    setEditingReservation(null); // Clear editing mode
    setNewReservationData({
      stationId,
      date,
      time,
      stationType: station?.type || ''
    });
    setAddReservationOpen(true);
  };

  // Open edit reservation dialog
  const handleEditReservation = (reservation: Reservation) => {
    const station = stations.find(s => s.id === reservation.station_id);
    setEditingReservation(reservation);
    setNewReservationData({
      stationId: reservation.station_id || '',
      date: reservation.reservation_date,
      time: reservation.start_time?.substring(0, 5) || '',
      stationType: station?.type || ''
    });
    setSelectedReservation(null); // Close details dialog
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
    setEditingReservation(null); // Clear editing mode
    setNewReservationData({
      stationId: firstStation?.id || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: timeStr,
      stationType: firstStation?.type || ''
    });
    setAddReservationOpen(true);
  };
  const handleReservationAdded = () => {
    // Refresh reservations from database - toast is shown in AddReservationDialog
    fetchReservations();
    setEditingReservation(null);
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
    const {
      error
    } = await supabase.from('breaks').delete().eq('id', breakId);
    if (error) {
      toast.error(t('errors.generic'));
      console.error('Error deleting break:', error);
      // Revert on error - refetch breaks
      fetchBreaks();
      return;
    }
    toast.success(t('common.success'));
  };
  const handleToggleClosedDay = async (date: string) => {
    if (!instanceId) return;
    const existingClosedDay = closedDays.find(cd => cd.closed_date === date);
    if (existingClosedDay) {
      // Day is closed - open it (delete from closed_days)
      setClosedDays(prev => prev.filter(cd => cd.id !== existingClosedDay.id));
      const {
        error
      } = await supabase.from('closed_days').delete().eq('id', existingClosedDay.id);
      if (error) {
        toast.error(t('errors.generic'));
        console.error('Error opening day:', error);
        fetchClosedDays();
        return;
      }
      toast.success(t('common.success'));
    } else {
      // Day is open - close it (insert to closed_days)
      const newClosedDay = {
        instance_id: instanceId,
        closed_date: date,
        reason: null
      };
      const {
        data,
        error
      } = await supabase.from('closed_days').insert(newClosedDay).select().single();
      if (error) {
        toast.error(t('errors.generic'));
        console.error('Error closing day:', error);
        return;
      }
      if (data) {
        setClosedDays(prev => [...prev, data]);
      }
      toast.success(t('common.success'));
    }
  };
  const handleConfirmReservation = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;

    const previousStatus = reservation.status;

    // Optimistic UI update (so it disappears from "Niepotwierdzone" instantly)
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      status: 'confirmed'
    } : r));
    setSelectedReservation(prev => prev && prev.id === reservationId ? {
      ...prev,
      status: 'confirmed'
    } : prev);

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'confirmed' })
      .eq('id', reservationId);

    if (error) {
      // Rollback optimistic update
      setReservations(prev => prev.map(r => r.id === reservationId ? {
        ...r,
        status: previousStatus
      } : r));
      setSelectedReservation(prev => prev && prev.id === reservationId ? {
        ...prev,
        status: previousStatus
      } : prev);

      toast.error(t('errors.generic'));
      console.error('Error confirming reservation:', error);
      return;
    }

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
      toast.success(t('reservations.reservationConfirmed'));
    } catch (smsError) {
      console.error('Failed to send confirmation SMS:', smsError);
      toast.success(t('reservations.reservationConfirmed'));
    }
  };
  const handleStartWork = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const {
      error: updateError
    } = await supabase.from('reservations').update({
      status: 'in_progress',
      started_at: new Date().toISOString()
    }).eq('id', reservationId);
    
    if (updateError) {
      toast.error(t('errors.generic'));
      console.error('Update error:', updateError);
      return;
    }

    // Update local state
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      status: 'in_progress'
    } : r));

    toast.success(t('reservations.workStarted'), {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    });
  };

  const handleEndWork = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const {
      error: updateError
    } = await supabase.from('reservations').update({
      status: 'completed'
    }).eq('id', reservationId);
    
    if (updateError) {
      toast.error(t('errors.generic'));
      console.error('Update error:', updateError);
      return;
    }

    // Update local state
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      status: 'completed'
    } : r));

    // Send SMS about work completion
    try {
      await supabase.functions.invoke('send-sms-message', {
        body: {
          phone: reservation.customer_phone,
          message: `Twój samochód (${reservation.vehicle_plate}) jest gotowy do odbioru. Zapraszamy!`,
          instanceId
        }
      });
      toast.success(t('reservations.workEnded'), {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      });
    } catch (smsError) {
      console.error('SMS error:', smsError);
      toast.success(t('reservations.workEnded'), {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      });
    }
  };

  const handleReleaseVehicle = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const {
      error: updateError
    } = await supabase.from('reservations').update({
      status: 'released'
    }).eq('id', reservationId);
    
    if (updateError) {
      toast.error(t('errors.generic'));
      console.error('Update error:', updateError);
      return;
    }

    // Update local state
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      status: 'released'
    } : r));

    toast.success(t('reservations.vehicleReleased'), {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    });
  };

  const handleRevertToConfirmed = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const {
      error: updateError
    } = await supabase.from('reservations').update({
      status: 'confirmed',
      started_at: null
    }).eq('id', reservationId);
    
    if (updateError) {
      toast.error(t('errors.generic'));
      console.error('Update error:', updateError);
      return;
    }

    // Update local state
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      status: 'confirmed'
    } : r));

    toast.success(t('reservations.revertedToConfirmed'), {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    });
  };

  const handleRevertToInProgress = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const {
      error: updateError
    } = await supabase.from('reservations').update({
      status: 'in_progress'
    }).eq('id', reservationId);
    
    if (updateError) {
      toast.error(t('errors.generic'));
      console.error('Update error:', updateError);
      return;
    }

    // Update local state
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      status: 'in_progress'
    } : r));

    toast.success(t('reservations.revertedToInProgress'), {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    });
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
      toast.error(t('errors.generic'));
      console.error('Error moving reservation:', error);
      return;
    }

    // Update local state
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      ...updates
    } : r));
    // Get vehicle model from reservation
    const vehicleModel = reservation.vehicle_plate || t('addReservation.defaultVehicle');

    // Show toast with reservation details
    toast.success(t('reservations.reservationMoved'), {
      description: (
        <div className="flex flex-col">
          <span>{updates.start_time} - {updates.end_time}</span>
          <span>{vehicleModel}</span>
        </div>
      ),
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      duration: 5000,
      action: {
        label: t('common.undo'),
        onClick: async () => {
          // Restore original state in database
          const {
            error: undoError
          } = await supabase.from('reservations').update(originalState).eq('id', reservationId);
          if (undoError) {
            toast.error(t('errors.generic'));
            console.error('Error undoing move:', undoError);
            return;
          }

          // Restore local state
          setReservations(prev => prev.map(r => r.id === reservationId ? {
            ...r,
            ...originalState
          } : r));
          toast.success(t('common.success'));
        }
      }
    });
  };

  // Handle yard vehicle drop onto calendar
  const handleYardVehicleDrop = async (vehicle: { id: string; customer_name: string; customer_phone: string; vehicle_plate: string; car_size: 'small' | 'medium' | 'large' | null; service_ids: string[]; notes: string | null }, stationId: string, date: string, time: string) => {
    if (!instanceId) return;
    
    // Calculate total duration based on services
    let totalDuration = 60; // Default 1 hour if no services
    
    if (vehicle.service_ids && vehicle.service_ids.length > 0) {
      totalDuration = vehicle.service_ids.reduce((total, serviceId) => {
        const service = allServices.find(s => s.id === serviceId);
        if (!service) return total;
        
        // Get duration based on car size
        let duration = service.duration_minutes || 60;
        if (vehicle.car_size === 'small' && service.duration_small) {
          duration = service.duration_small;
        } else if (vehicle.car_size === 'medium' && service.duration_medium) {
          duration = service.duration_medium;
        } else if (vehicle.car_size === 'large' && service.duration_large) {
          duration = service.duration_large;
        }
        
        return total + duration;
      }, 0);
      
      // Minimum 30 minutes
      if (totalDuration < 30) totalDuration = 30;
    }
    
    // Calculate end time based on duration
    const [hours, mins] = time.split(':').map(Number);
    const endMinutes = hours * 60 + mins + totalDuration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
    
    // Generate confirmation code
    const confirmationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Get first service ID or fetch a default one
    let primaryServiceId = vehicle.service_ids?.[0];
    if (!primaryServiceId && allServices.length > 0) {
      primaryServiceId = allServices[0].id;
    }
    
    if (!primaryServiceId) {
      toast.error('Brak usług - dodaj usługę do pojazdu lub utwórz usługę w systemie');
      return;
    }
    
    try {
      // Create reservation from yard vehicle data
      const { error: reservationError } = await supabase.from('reservations').insert([{
        instance_id: instanceId,
        station_id: stationId,
        reservation_date: date,
        start_time: time,
        end_time: endTime,
        customer_name: vehicle.customer_name,
        customer_phone: vehicle.customer_phone,
        vehicle_plate: vehicle.vehicle_plate,
        car_size: vehicle.car_size,
        service_id: primaryServiceId,
        service_ids: vehicle.service_ids || [],
        notes: vehicle.notes,
        confirmation_code: confirmationCode,
        status: 'confirmed' as const,
        source: 'admin'
      }]);
      
      if (reservationError) throw reservationError;
      
      // Delete from yard_vehicles
      const { error: deleteError } = await supabase.from('yard_vehicles').delete().eq('id', vehicle.id);
      if (deleteError) console.error('Error deleting yard vehicle:', deleteError);
      
      fetchReservations();
      toast.success('Rezerwacja utworzona z placu');
    } catch (error) {
      console.error('Error creating reservation from yard:', error);
      toast.error('Błąd podczas tworzenia rezerwacji');
    }
  };

  const pendingCount = reservations.filter(r => (r.status || 'pending') === 'pending').length;
  return <>
      <Helmet>
        <title>Panel Admina - {instanceData?.name || 'N2Wash'}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen h-screen bg-background flex overflow-hidden">
        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar - fixed height, never scrolls */}
        <aside className={cn("fixed lg:sticky top-0 inset-y-0 left-0 z-50 h-screen bg-card border-r border-border/50 transition-all duration-300 flex-shrink-0", sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0", sidebarCollapsed ? "lg:w-16" : "w-64")}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Logo */}
            <div className={cn("border-b border-border/50 flex items-center justify-between", sidebarCollapsed ? "p-3" : "p-6")}>
              <button 
                onClick={() => setCurrentView('calendar')} 
                className={cn("flex items-center cursor-pointer hover:opacity-80 transition-opacity", sidebarCollapsed ? "justify-center" : "gap-3")}
              >
                {instanceData?.logo_url ? (
                  <img 
                    src={instanceData.logo_url} 
                    alt={instanceData.name} 
                    className="w-10 h-10 rounded-xl object-contain shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-primary-foreground" />
                  </div>
                )}
                {!sidebarCollapsed && <div className="text-left">
                    <h1 className="font-bold text-foreground">{instanceData?.name || 'Panel Admina'}</h1>
                    <p className="text-xs text-muted-foreground">Panel Admina</p>
                  </div>}
              </button>
            </div>

            {/* Navigation */}
            <nav className={cn("flex-1 space-y-2", sidebarCollapsed ? "p-2" : "p-4")}>
              <Button variant={currentView === 'calendar' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('calendar'); setSidebarOpen(false); }} title="Kalendarz">
                <Calendar className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Kalendarz"}
              </Button>
              <Button variant={currentView === 'reservations' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('reservations'); setSidebarOpen(false); }} title="Rezerwacje">
                <div className="relative">
                  <Users className="w-4 h-4 shrink-0" />
                  {sidebarCollapsed && pendingCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                      {pendingCount}
                    </span>}
                </div>
                {!sidebarCollapsed && <>
                    <span className="flex-1 text-left">Rezerwacje</span>
                    {pendingCount > 0 && <span className="min-w-[20px] h-5 px-1.5 text-xs font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                        {pendingCount}
                      </span>}
                  </>}
              </Button>
              <Button variant={currentView === 'notifications' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('notifications'); setSidebarOpen(false); }} title="Powiadomienia">
                <div className="relative">
                  <Bell className="w-4 h-4 shrink-0" />
                  {sidebarCollapsed && unreadNotificationsCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>}
                </div>
                {!sidebarCollapsed && <>
                    <span className="flex-1 text-left">Powiadomienia</span>
                    {unreadNotificationsCount > 0 && <span className="min-w-[20px] h-5 px-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                        {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                      </span>}
                  </>}
              </Button>
              <Button variant={currentView === 'customers' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('customers'); setSidebarOpen(false); }} title="Klienci">
                <UserCircle className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Klienci"}
              </Button>
              {hasFeature('offers') && <Button variant={currentView === 'offers' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('offers'); setSidebarOpen(false); }} title="Oferty">
                  <FileText className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Oferty"}
                </Button>}
              {hasFeature('offers') && <Button variant={currentView === 'products' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('products'); setSidebarOpen(false); }} title="Produkty">
                  <Package className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Produkty"}
                </Button>}
              {hasFeature('followup') && <Button variant={currentView === 'followup' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('followup'); setSidebarOpen(false); }} title="Follow-up">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Follow-up"}
                </Button>}
              <Button variant={currentView === 'settings' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setCurrentView('settings'); setSidebarOpen(false); }} title="Ustawienia">
                <Settings className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Ustawienia"}
              </Button>
            </nav>

            {/* Collapse toggle & User menu */}
            <div className={cn("border-t border-border/50", sidebarCollapsed ? "p-2" : "p-4")}>
              {/* Collapse button - desktop only */}
              <Button
                variant="ghost"
                className={cn(
                  "w-full text-muted-foreground hidden lg:flex gap-3",
                  sidebarCollapsed ? "justify-center px-2" : "justify-start",
                )}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? "Rozwiń menu" : "Zwiń menu"}
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="w-4 h-4 shrink-0" />
                ) : (
                  <>
                    <PanelLeftClose className="w-4 h-4 shrink-0" />
                    Zwiń menu
                  </>
                )}
              </Button>

              {/* Divider - only when not collapsed */}
              {!sidebarCollapsed && <Separator className="my-3" />}

              {/* Email -> dropdown (logout) */}
              {sidebarCollapsed ? (
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2 text-muted-foreground"
                  onClick={handleLogout}
                  title="Wyloguj się"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                </Button>
              ) : (
                user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-muted-foreground px-3 h-auto py-2"
                      >
                        <span className="text-sm truncate">{user.email}</span>
                        <ChevronUp className="w-4 h-4 shrink-0 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
                      <DropdownMenuItem onClick={handleLogout} className="gap-2">
                        <LogOut className="w-4 h-4" />
                        Wyloguj się
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              )}
            </div>
          </div>
        </aside>

        {/* Main Content - scrollable */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Mobile Header - removed for cleaner mobile experience */}

          {/* Desktop Notification Bell - now in fixed position via AdminLayout */}

          {/* Content */}
          <div className={cn(
            "flex-1 space-y-6 overflow-auto pb-20 lg:pb-8",
            currentView === 'calendar' ? "p-0 lg:p-4 lg:pt-0" : "p-4 pt-0"
          )}>
            {/* Header - only shown for non-calendar views that need it */}
            {['reservations', 'customers', 'settings'].includes(currentView) && <h1 className="text-2xl font-bold text-foreground">
                {currentView === 'reservations' ? t('reservations.title') : currentView === 'customers' ? t('customers.title') : t('settings.title')}
              </h1>}

            {/* Free Time Ranges Per Station - Hidden on desktop, shown via bottom sheet on mobile */}

            {/* View Content */}
            {currentView === 'calendar' && <div className="flex-1 min-h-[600px] h-full relative">
                <AdminCalendar stations={stations} reservations={reservations} breaks={breaks} closedDays={closedDays} workingHours={workingHours} onReservationClick={handleReservationClick} onAddReservation={handleAddReservation} onAddBreak={handleAddBreak} onDeleteBreak={handleDeleteBreak} onToggleClosedDay={handleToggleClosedDay} onReservationMove={handleReservationMove} onConfirmReservation={handleConfirmReservation} onYardVehicleDrop={handleYardVehicleDrop} instanceId={instanceId || undefined} yardVehicleCount={yardVehicleCount} />
                
                {/* Floating + button for quick add reservation V2 - hidden on mobile */}
                <button
                  onClick={() => setAddReservationV2Open(true)}
                  className="hidden lg:flex fixed bottom-8 right-6 z-50 w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-200 items-center justify-center"
                  title={t('addReservation.quickAdd')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>}

            {currentView === 'reservations' && (
              <ReservationsView
                reservations={reservations}
                allServices={allServices}
                onReservationClick={handleReservationClick}
                onConfirmReservation={handleConfirmReservation}
                onRejectReservation={handleRejectReservation}
              />
            )}

            {currentView === 'customers' && <CustomersView instanceId={instanceId} />}

            {currentView === 'settings' && (
              <SettingsView 
                instanceId={instanceId} 
                instanceData={instanceData}
                onInstanceUpdate={(data) => setInstanceData(data)}
              />
            )}

            {currentView === 'offers' && <OffersView instanceId={instanceId} onNavigateToProducts={() => setCurrentView('products')} />}

            {currentView === 'products' && <ProductsView instanceId={instanceId} />}

            {currentView === 'followup' && <FollowUpView instanceId={instanceId} />}

            {currentView === 'notifications' && <NotificationsView 
              instanceId={instanceId} 
              onNavigateBack={() => setCurrentView('calendar')} 
              onNavigateToOffers={() => setCurrentView('offers')}
              onNavigateToReservations={() => setCurrentView('reservations')}
            />}
          </div>
        </main>
      </div>

      {/* Reservation Details Drawer */}
      <ReservationDetailsDrawer 
        reservation={selectedReservation} 
        open={!!selectedReservation} 
        onClose={() => setSelectedReservation(null)} 
        onDelete={handleDeleteReservation} 
        onEdit={handleEditReservation}
        onConfirm={async id => {
          await handleConfirmReservation(id);
          setSelectedReservation(null);
        }} 
        onStartWork={async id => {
          await handleStartWork(id);
          setSelectedReservation(null);
        }}
        onEndWork={async id => {
          await handleEndWork(id);
          setSelectedReservation(null);
        }}
        onRelease={async id => {
          await handleReleaseVehicle(id);
          setSelectedReservation(null);
        }}
        onRevertToConfirmed={async id => {
          await handleRevertToConfirmed(id);
          setSelectedReservation(null);
        }}
        onRevertToInProgress={async id => {
          await handleRevertToInProgress(id);
          setSelectedReservation(null);
        }}
      />

      {/* Add/Edit Reservation Dialog V2 */}
      {instanceId && (
        <AddReservationDialogV2
          open={addReservationOpen || addReservationV2Open}
          onClose={() => {
            setAddReservationOpen(false);
            setAddReservationV2Open(false);
            setEditingReservation(null);
          }}
          instanceId={instanceId}
          onSuccess={handleReservationAdded}
          workingHours={workingHours}
          editingReservation={editingReservation ? {
            id: editingReservation.id,
            customer_name: editingReservation.customer_name,
            customer_phone: editingReservation.customer_phone,
            vehicle_plate: editingReservation.vehicle_plate,
            car_size: (editingReservation as any).car_size || null,
            reservation_date: editingReservation.reservation_date,
            end_date: editingReservation.end_date,
            start_time: editingReservation.start_time,
            end_time: editingReservation.end_time,
            station_id: editingReservation.station_id,
            service_ids: (editingReservation as any).service_ids,
            service_id: (editingReservation as any).service_id,
            notes: (editingReservation as any).notes,
            price: editingReservation.price,
          } : null}
        />
      )}

      {/* Add Break Dialog */}
      {instanceId && <AddBreakDialog open={addBreakOpen} onOpenChange={setAddBreakOpen} instanceId={instanceId} stations={stations} initialData={newBreakData} onBreakAdded={handleBreakAdded} />}

      <InstanceSettingsDialog open={instanceSettingsOpen} onOpenChange={setInstanceSettingsOpen} instance={instanceData} onUpdate={updated => {
      setInstanceData(updated);
    }} />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        stations={stations} 
        reservations={reservations} 
        currentDate={format(new Date(), 'yyyy-MM-dd')}
        workingHours={workingHours}
        onAddReservation={handleQuickAddReservation} 
        onAddReservationWithSlot={handleAddReservation}
        onLogout={handleLogout}
        unreadNotificationsCount={unreadNotificationsCount}
        offersEnabled={hasFeature('offers')}
        followupEnabled={hasFeature('followup')}
      />
    </>;
};
export default AdminDashboard;