import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Building2, Car, Calendar, LogOut, Menu, CheckCircle, Settings, Users, UserCircle, PanelLeftClose, PanelLeft, FileText, CalendarClock, ChevronUp, Package, Bell, ClipboardCheck } from 'lucide-react';
import { UpdateBanner } from '@/components/admin/UpdateBanner';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import HallsListView from '@/components/admin/halls/HallsListView';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, subMonths, addDays, parseISO, getDay } from 'date-fns';
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
import { ProtocolsView } from '@/components/protocols/ProtocolsView';
import { toast } from 'sonner';
import { sendPushNotification, formatDateForPush } from '@/lib/pushNotifications';
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
    price_small?: number | null;
    price_medium?: number | null;
    price_large?: number | null;
    price_from?: number | null;
  }>;
  station?: {
    name: string;
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
  price: number | null;
  original_reservation_id?: string | null;
  original_reservation?: {
    reservation_date: string;
    start_time: string;
    confirmation_code: string;
  } | null;
  created_by?: string | null;
  created_by_username?: string | null;
  offer_number?: string | null;
  confirmation_sms_sent_at?: string | null;
  pickup_sms_sent_at?: string | null;
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
type ViewType = 'calendar' | 'reservations' | 'customers' | 'settings' | 'offers' | 'products' | 'followup' | 'notifications' | 'halls' | 'protocols';
const validViews: ViewType[] = ['calendar', 'reservations', 'customers', 'settings', 'offers', 'products', 'followup', 'notifications', 'halls', 'protocols'];
const AdminDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    view
  } = useParams<{
    view?: string;
  }>();
  const {
    user,
    signOut
  } = useAuth();
  const { currentVersion } = useAppUpdate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    return saved === 'true';
  });

  // Deep linking: check for reservationCode in URL
  const reservationCodeFromUrl = searchParams.get('reservationCode');

  // Derive currentView from URL param
  const currentView: ViewType =
    view && validViews.includes(view as ViewType) ? (view as ViewType) : 'calendar';

  // Support both route bases:
  // - dev/staging: /admin/:view
  // - instance admin subdomain: /:view
  const location = useLocation();
  const adminBasePath = location.pathname.startsWith('/admin') ? '/admin' : '';

  const setCurrentView = (newView: ViewType) => {
    const target =
      newView === 'calendar' ? adminBasePath || '/' : `${adminBasePath}/${newView}`;
    navigate(target);
  };
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  // Loaded date range for reservations - 2 months back initially, null = all future
  const [loadedDateRange, setLoadedDateRange] = useState<{ from: Date; to: null }>({
    from: subMonths(new Date(), 2),
    to: null
  });
  const [isLoadingMoreReservations, setIsLoadingMoreReservations] = useState(false);
  
  // Realtime connection state
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  
  // Ref to track loadedDateRange for realtime handler (avoids re-subscribing on date change)
  const loadedDateRangeRef = useRef(loadedDateRange);
  useEffect(() => {
    loadedDateRangeRef.current = loadedDateRange;
  }, [loadedDateRange]);

  // Debounce mechanism to prevent realtime updates from overwriting local changes
  const recentlyUpdatedReservationsRef = useRef<Map<string, number>>(new Map());
  
  const markAsLocallyUpdated = useCallback((reservationId: string, durationMs = 3000) => {
    recentlyUpdatedReservationsRef.current.set(reservationId, Date.now());
    setTimeout(() => {
      recentlyUpdatedReservationsRef.current.delete(reservationId);
    }, durationMs);
  }, []);

  // Deep link handling ref to prevent infinite loops
  const deepLinkHandledRef = useRef(false);
  
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

  // Slot preview for live calendar highlight
  const [slotPreview, setSlotPreview] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    stationId: string;
  } | null>(null);
  
  // Memoized callback to prevent re-renders in AddReservationDialogV2
  const handleSlotPreviewChange = useCallback((preview: {
    date: string;
    startTime: string;
    endTime: string;
    stationId: string;
  } | null) => {
    setSlotPreview(preview);
  }, []);

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
  
  // User role (admin or employee)
  const [userRole, setUserRole] = useState<'admin' | 'employee' | null>(null);

  // Get user's username from profiles
  const [username, setUsername] = useState<string | null>(null);
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

  // Current calendar date (synced from AdminCalendar) - initialize from same localStorage source
  const [calendarDate, setCalendarDate] = useState<Date>(() => {
    const saved = localStorage.getItem('admin-calendar-date');
    if (saved) {
      try {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) return parsed;
      } catch {}
    }
    return new Date();
  });
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
        setUserRole('admin');
        return;
      }

      // Check if user has employee role with instance_id
      const employeeRole = rolesData.find(r => r.role === 'employee' && r.instance_id);
      if (employeeRole?.instance_id) {
        setInstanceId(employeeRole.instance_id);
        setUserRole('employee');
        return;
      }

      // Check for super_admin - get first available instance
      const isSuperAdmin = rolesData.some(r => r.role === 'super_admin');
      if (isSuperAdmin) {
        setUserRole('admin'); // super_admin has admin privileges
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

  // Fetch username from profiles
  useEffect(() => {
    const fetchUsername = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.username) {
        setUsername(data.username);
      }
    };
    fetchUsername();
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

  // Helper to find nearest working day
  const findNearestWorkingDay = (date: Date, hours: Record<string, { open: string; close: string } | null>): Date => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let i = 0; i < 7; i++) {
      const checkDate = addDays(date, i);
      const dayName = dayNames[getDay(checkDate)];
      const dayConfig = hours[dayName];
      
      // Day is open if it has valid open/close times
      if (dayConfig && dayConfig.open && dayConfig.close) {
        return checkDate;
      }
    }
    
    // Fallback to original date if no working day found
    return date;
  };

  // Set calendar to nearest working day when working hours are loaded
  useEffect(() => {
    if (!workingHours) return;
    
    const today = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = dayNames[getDay(today)];
    const todayConfig = workingHours[todayDayName];
    
    // Check if today is a working day
    const isTodayWorkingDay = todayConfig && todayConfig.open && todayConfig.close;
    
    if (!isTodayWorkingDay) {
      const nearestWorkingDay = findNearestWorkingDay(today, workingHours);
      setCalendarDate(nearestWorkingDay);
      localStorage.setItem('admin-calendar-date', nearestWorkingDay.toISOString());
    }
  }, [workingHours]);

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

  // Map raw reservation data to Reservation type
  const mapReservationData = useCallback((
    data: any[],
    servicesMap: Map<string, { name: string; shortcut?: string | null; price_small?: number | null; price_medium?: number | null; price_large?: number | null; price_from?: number | null }>,
    originalReservationsMap: Map<string, any>
  ): Reservation[] => {
    return data.map(r => {
      const serviceIds = (r as any).service_ids as string[] | null;
      const servicesDataMapped: Array<{
        name: string;
        shortcut?: string | null;
        price_small?: number | null;
        price_medium?: number | null;
        price_large?: number | null;
        price_from?: number | null;
      }> = [];
      if (serviceIds && serviceIds.length > 0) {
        serviceIds.forEach(id => {
          const svc = servicesMap.get(id);
          if (svc) {
            servicesDataMapped.push(svc);
          } else {
            // Graceful fallback for deleted services
            servicesDataMapped.push({
              name: '(usługa usunięta)',
              shortcut: null,
              price_small: null,
              price_medium: null,
              price_large: null,
              price_from: null
            });
          }
        });
      }
      
      const originalReservation = r.original_reservation_id 
        ? originalReservationsMap.get(r.original_reservation_id) 
        : null;

      return {
        ...r,
        status: r.status || 'pending',
        service: r.services ? {
          name: (r.services as any).name,
          shortcut: (r.services as any).shortcut
        } : undefined,
        services_data: servicesDataMapped.length > 0 ? servicesDataMapped : undefined,
        station: r.stations ? {
          name: (r.stations as any).name,
          type: (r.stations as any).type
        } : undefined,
        original_reservation: originalReservation || null,
        created_by_username: r.created_by_username || null
      };
    });
  }, []);

  // Reference to services map for realtime updates
  const servicesMapRef = useRef<Map<string, { name: string; shortcut?: string | null; price_small?: number | null; price_medium?: number | null; price_large?: number | null; price_from?: number | null }>>(new Map());

  // Fetch reservations from database with date range filter
  // Initial load: 2 months back + all future reservations
  const fetchReservations = async (fromDate?: Date, toDate?: Date | null) => {
    if (!instanceId) return;

    const from = fromDate || loadedDateRange.from;
    const to = toDate === undefined ? loadedDateRange.to : toDate;

    // First fetch services to map service_ids (include pricing)
    // Fetch ALL services (including inactive) to properly map historical reservations
    const {
      data: servicesData
    } = await supabase.from('services').select('id, name, shortcut, price_small, price_medium, price_large, price_from').eq('instance_id', instanceId);
    const servicesMap = new Map<string, {
      name: string;
      shortcut?: string | null;
      price_small?: number | null;
      price_medium?: number | null;
      price_large?: number | null;
      price_from?: number | null;
    }>();
    if (servicesData) {
      servicesData.forEach(s => servicesMap.set(s.id, {
        name: s.name,
        shortcut: s.shortcut,
        price_small: s.price_small,
        price_medium: s.price_medium,
        price_large: s.price_large,
        price_from: s.price_from
      }));
    }
    // Save for realtime updates
    servicesMapRef.current = servicesMap;

    // Build query with date filter
    let query = supabase.from('reservations').select(`
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
        customer_notes,
        admin_notes,
        source,
        car_size,
        service_ids,
        original_reservation_id,
        created_by,
        created_by_username,
        offer_number,
        confirmation_sms_sent_at,
        pickup_sms_sent_at,
        services:service_id (name, shortcut),
        stations:station_id (name, type)
      `).eq('instance_id', instanceId)
      .gte('reservation_date', format(from, 'yyyy-MM-dd'));
    
    // If to is not null, add upper bound filter
    if (to !== null) {
      query = query.lte('reservation_date', format(to, 'yyyy-MM-dd'));
    }

    const { data, error } = await query;
    
    if (!error && data) {
      // Fetch original reservation data for change requests
      const changeRequestIds = data
        .filter(r => r.original_reservation_id)
        .map(r => r.original_reservation_id);
      
      const originalReservationsMap = new Map<string, any>();
      if (changeRequestIds.length > 0) {
        const { data: originals } = await supabase
          .from('reservations')
          .select('id, reservation_date, start_time, confirmation_code')
          .in('id', changeRequestIds);
        
        if (originals) {
          originals.forEach(o => originalReservationsMap.set(o.id, o));
        }
      }

      setReservations(mapReservationData(data, servicesMap, originalReservationsMap));
    }
  };

  // Load more reservations when user navigates to dates near the edge of loaded data
  const loadMoreReservations = useCallback(async (direction: 'past') => {
    if (!instanceId || isLoadingMoreReservations) return;

    if (direction === 'past') {
      setIsLoadingMoreReservations(true);
      
      const newFrom = subMonths(loadedDateRange.from, 1);
      const oldFrom = loadedDateRange.from;
      
      // First fetch services to map service_ids
      const servicesMap = servicesMapRef.current;
      
      // Fetch additional reservations
      const { data, error } = await supabase.from('reservations').select(`
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
          customer_notes,
          admin_notes,
          source,
          car_size,
          service_ids,
          original_reservation_id,
          created_by,
          created_by_username,
          offer_number,
          confirmation_sms_sent_at,
          pickup_sms_sent_at,
          services:service_id (name, shortcut),
          stations:station_id (name, type)
        `).eq('instance_id', instanceId)
        .gte('reservation_date', format(newFrom, 'yyyy-MM-dd'))
        .lt('reservation_date', format(oldFrom, 'yyyy-MM-dd'));
      
      if (!error && data && data.length > 0) {
        // Fetch original reservation data for change requests
        const changeRequestIds = data
          .filter(r => r.original_reservation_id)
          .map(r => r.original_reservation_id);
        
        const originalReservationsMap = new Map<string, any>();
        if (changeRequestIds.length > 0) {
          const { data: originals } = await supabase
            .from('reservations')
            .select('id, reservation_date, start_time, confirmation_code')
            .in('id', changeRequestIds);
          
          if (originals) {
            originals.forEach(o => originalReservationsMap.set(o.id, o));
          }
        }

        const mappedData = mapReservationData(data, servicesMap, originalReservationsMap);
        setReservations(prev => [...mappedData, ...prev]);
      }
      
      setLoadedDateRange(prev => ({ ...prev, from: newFrom }));
      setIsLoadingMoreReservations(false);
    }
  }, [instanceId, isLoadingMoreReservations, loadedDateRange.from, mapReservationData]);

  // Handle calendar date change - load more data if approaching edge
  const handleCalendarDateChange = useCallback((date: Date) => {
    setCalendarDate(date);
    
    // Check if we're approaching the edge of loaded data (within 7 days buffer)
    const bufferDays = 7;
    if (date < addDays(loadedDateRange.from, bufferDays)) {
      loadMoreReservations('past');
    }
  }, [loadedDateRange.from, loadMoreReservations]);

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

  // Deep linking: auto-open reservation from URL param
  // If reservation is not in loaded range, fetch it directly
  // Reset handled flag when reservation code changes
  useEffect(() => {
    deepLinkHandledRef.current = false;
  }, [reservationCodeFromUrl]);

  useEffect(() => {
    const handleDeepLink = async () => {
      if (!reservationCodeFromUrl || !instanceId) return;
      if (deepLinkHandledRef.current) return; // Already handled this code
      
      // First check if reservation is already in state
      const existingReservation = reservations.find(r => r.confirmation_code === reservationCodeFromUrl);
      if (existingReservation) {
        deepLinkHandledRef.current = true;
        setSelectedReservation(existingReservation);
        searchParams.delete('reservationCode');
        setSearchParams(searchParams, { replace: true });
        return;
      }
      
      // If not found in state (might be outside loaded date range), fetch directly
      // Only try once when reservations are loaded
      if (reservations.length > 0) {
        deepLinkHandledRef.current = true;
        const { data } = await supabase
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
            customer_notes,
            admin_notes,
            source,
            car_size,
            service_ids,
            original_reservation_id,
            offer_number,
            confirmation_sms_sent_at,
            pickup_sms_sent_at,
            services:service_id (name, shortcut),
            stations:station_id (name, type)
          `)
          .eq('instance_id', instanceId)
          .eq('confirmation_code', reservationCodeFromUrl)
          .maybeSingle();
        
        if (data) {
          const mappedReservation: Reservation = {
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
          // Add to state temporarily so drawer can open
          setReservations(prev => [...prev, mappedReservation]);
          setSelectedReservation(mappedReservation);
          searchParams.delete('reservationCode');
          setSearchParams(searchParams, { replace: true });
        }
      }
    };
    
    handleDeepLink();
    // IMPORTANT: Removed 'reservations' from dependencies to prevent infinite loop
  }, [reservationCodeFromUrl, instanceId, searchParams, setSearchParams]);

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
  // IMPORTANT: Only instanceId as dependency to maintain stable WebSocket connection
  useEffect(() => {
    if (!instanceId) return;
    
    let retryCount = 0;
    const maxRetries = 10;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeoutId: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    const setupRealtimeChannel = () => {
      if (isCleanedUp) return;
      
      // Remove previous channel if exists
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
      }

      currentChannel = supabase.channel(`reservations-changes-${Date.now()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `instance_id=eq.${instanceId}`
        }, payload => {
          console.log('Realtime reservation update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as any;
            const reservationDate = parseISO(newRecord.reservation_date);
            
            // Use ref to check date range without causing re-subscription
            const isWithinRange = reservationDate >= loadedDateRangeRef.current.from;
            
            if (!isWithinRange) {
              return;
            }

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
              service_ids,
              created_by_username,
              offer_number,
              services:service_id (name, shortcut),
              stations:station_id (name, type)
            `).eq('id', payload.new.id).single().then(({ data }) => {
              if (data) {
                const serviceIds = (data as any).service_ids as string[] | null;
                const servicesDataMapped: Array<{ name: string; shortcut?: string | null }> = [];
                if (serviceIds && serviceIds.length > 0) {
                  serviceIds.forEach(id => {
                    const svc = servicesMapRef.current.get(id);
                    if (svc) servicesDataMapped.push({ name: svc.name, shortcut: svc.shortcut });
                  });
                }

                const newReservation = {
                  ...data,
                  status: data.status || 'pending',
                  service: data.services ? {
                    name: (data.services as any).name,
                    shortcut: (data.services as any).shortcut
                  } : undefined,
                  services_data: servicesDataMapped.length > 0 ? servicesDataMapped : undefined,
                  station: data.stations ? {
                    name: (data.stations as any).name,
                    type: (data.stations as any).type
                  } : undefined,
                  created_by_username: (data as any).created_by_username || null
                };
                setReservations(prev => {
                  // Prevent duplicates (in case fetch also returned this reservation)
                  if (prev.some(r => r.id === data.id)) {
                    return prev.map(r => r.id === data.id ? newReservation as Reservation : r);
                  }
                  return [...prev, newReservation as Reservation];
                });
                
                const isCustomerReservation = (data as any).source === 'customer';
                if (isCustomerReservation) {
                  toast.success('🔔 Nowa rezerwacja od klienta!', {
                    description: `${data.customer_name} - ${data.start_time}`
                  });
                }
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            // Skip if recently updated locally (debounce to prevent flickering)
            const lastLocalUpdate = recentlyUpdatedReservationsRef.current.get(payload.new.id);
            if (lastLocalUpdate && Date.now() - lastLocalUpdate < 3000) {
              console.log('[Realtime] Skipping update for locally modified reservation:', payload.new.id);
              return;
            }
            
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
              service_ids,
              admin_notes,
              customer_notes,
              car_size,
              offer_number,
              services:service_id (name, shortcut),
              stations:station_id (name, type)
            `).eq('id', payload.new.id).single().then(({ data }) => {
              if (data) {
                const serviceIds = (data as any).service_ids as string[] | null;
                const servicesDataMapped: Array<{ name: string; shortcut?: string | null }> = [];
                if (serviceIds && serviceIds.length > 0) {
                  serviceIds.forEach(id => {
                    const svc = servicesMapRef.current.get(id);
                    if (svc) servicesDataMapped.push({ name: svc.name, shortcut: svc.shortcut });
                  });
                }

                const updatedReservation = {
                  ...data,
                  status: data.status || 'pending',
                  service: data.services ? {
                    name: (data.services as any).name,
                    shortcut: (data.services as any).shortcut
                  } : undefined,
                  services_data: servicesDataMapped.length > 0 ? servicesDataMapped : undefined,
                  station: data.stations ? {
                    name: (data.stations as any).name,
                    type: (data.stations as any).type
                  } : undefined
                };
                setReservations(prev => prev.map(r => r.id === payload.new.id ? updatedReservation as Reservation : r));
              }
            });
          } else if (payload.eventType === 'DELETE') {
            setReservations(prev => prev.filter(r => r.id !== payload.old.id));
          }
        })
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            setRealtimeConnected(true);
            retryCount = 0; // Reset on successful connection
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setRealtimeConnected(false);
            
            if (isCleanedUp) return;
            
            // Silent retry with exponential backoff
            if (retryCount < maxRetries) {
              retryCount++;
              const delay = Math.min(1000 * Math.pow(1.5, retryCount), 30000); // Max 30 seconds
              console.log(`Realtime retry ${retryCount}/${maxRetries} in ${delay}ms`);
              
              retryTimeoutId = setTimeout(() => {
                if (isCleanedUp) return;
                // Fetch data in case events were missed
                fetchReservations();
                // Setup new WebSocket connection
                setupRealtimeChannel();
              }, delay);
            } else {
              console.error('Max realtime retries reached, falling back to periodic fetch');
              // Fallback: periodic fetch every 30s and retry connection
              retryTimeoutId = setTimeout(() => {
                if (isCleanedUp) return;
                fetchReservations();
                retryCount = 0; // Reset and try again
                setupRealtimeChannel();
              }, 30000);
            }
          }
        });
    };

    // Initial connection
    setupRealtimeChannel();

    return () => {
      isCleanedUp = true;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [instanceId]); // Only instanceId - stable subscription

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
    navigate('/login');
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
        // Continue with cancellation even if customer save fails
      }

      // Soft delete - update status to cancelled with timestamp and user
      const {
        error: updateError
      } = await supabase.from('reservations').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id || null
      }).eq('id', reservationId);
      
      if (updateError) {
        toast.error(t('errors.generic'));
        console.error('Error cancelling reservation:', updateError);
        return;
      }

      // Send push notification for deletion
      if (instanceId) {
        sendPushNotification({
          instanceId,
          title: `🚫 Rezerwacja anulowana`,
          body: `${customerData.name} - anulowana przez admina`,
          url: '/admin',
          tag: `deleted-reservation-${reservationId}`,
        });
      }

      // Remove from local state (cancelled reservations hidden from calendar)
      setReservations(prev => prev.filter(r => r.id !== reservationId));
      setSelectedReservation(null);
      toast.success(t('reservations.reservationRejected'));
    } catch (error) {
      console.error('Error in cancel operation:', error);
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

        // Soft delete - update status to cancelled with timestamp and user
        const { error } = await supabase.from('reservations').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id || null
        }).eq('id', reservationId);
        
        if (error) {
          console.error('Error rejecting reservation:', error);
          // Restore if update failed
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

  // Quick add reservation (for mobile bottom nav / FAB) - opens with "Dostępne sloty" tab
  const handleQuickAddReservation = () => {
    setEditingReservation(null); // Clear editing mode
    setNewReservationData({
      stationId: '',
      date: '',
      time: '',
      stationType: ''
    });
    setAddReservationOpen(true);
  };
  const handleReservationAdded = (reservationId?: string) => {
    // For edit mode, refresh reservations to show updated data in UI
    // Realtime debounce was blocking updates for locally edited reservations
    if (reservationId || editingReservation?.id) {
      // Refresh immediately to show updated reservation
      fetchReservations();
    }
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
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
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
      const monthNames = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "wrzesnia", "pazdziernika", "listopada", "grudnia"];
      const dayNum = dateObj.getDate();
      const monthName = monthNames[dateObj.getMonth()];
      const instanceName = instanceData?.short_name || instanceData?.name || 'Myjnia';
      const manageUrl = `${window.location.origin}/moja-rezerwacja?code=${reservation.confirmation_code}`;
      const message = `${instanceName}: Rezerwacja potwierdzona! ${dayNum} ${monthName} o ${reservation.start_time?.slice(0, 5)}. Zmien lub anuluj: ${manageUrl}`;
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
      status: 'completed',
      completed_at: new Date().toISOString()
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

    toast.success(t('reservations.workEnded'), {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    });
  };

  const handleReleaseVehicle = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const {
      error: updateError
    } = await supabase.from('reservations').update({
      status: 'released',
      released_at: new Date().toISOString()
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

  const handleSendPickupSms = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;

    const instanceName = instanceData?.short_name || instanceData?.name || 'Myjnia';
    
    // Optimistic update - set timestamp immediately
    const now = new Date().toISOString();
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      pickup_sms_sent_at: now
    } : r));
    // Also update selectedReservation for drawer UI
    setSelectedReservation(prev => prev && prev.id === reservationId ? {
      ...prev,
      pickup_sms_sent_at: now
    } : prev);

    try {
      await supabase.functions.invoke('send-sms-message', {
        body: {
          phone: reservation.customer_phone,
          message: `${instanceName}: Twoj samochod jest gotowy do odbioru. Zapraszamy!`,
          instanceId
        }
      });
      
      // Save pickup SMS sent timestamp to DB
      await supabase
        .from('reservations')
        .update({ pickup_sms_sent_at: now })
        .eq('id', reservationId);
      
      toast.success(t('reservations.pickupSmsSent', { customerName: reservation.customer_name }));
    } catch (error) {
      console.error('SMS error:', error);
      // Rollback optimistic update on error
      setReservations(prev => prev.map(r => r.id === reservationId ? {
        ...r,
        pickup_sms_sent_at: reservation.pickup_sms_sent_at
      } : r));
      setSelectedReservation(prev => prev && prev.id === reservationId ? {
        ...prev,
        pickup_sms_sent_at: reservation.pickup_sms_sent_at
      } : prev);
      toast.error(t('errors.generic'));
    }
  };

  const handleSendConfirmationSms = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation || !reservation.customer_phone) return;

    // Optimistic update - set timestamp immediately
    const now = new Date().toISOString();
    setReservations(prev => prev.map(r => r.id === reservationId ? {
      ...r,
      confirmation_sms_sent_at: now
    } : r));
    // Also update selectedReservation for drawer UI
    setSelectedReservation(prev => prev && prev.id === reservationId ? {
      ...prev,
      confirmation_sms_sent_at: now
    } : prev);

    try {
      // Fetch instance data for SMS
      const { data: instData } = await supabase
        .from('instances')
        .select('name, short_name, google_maps_url, slug')
        .eq('id', instanceId)
        .single();

      if (!instData) return;

      // Check if SMS edit link feature is enabled
      const { data: smsEditLinkFeature } = await supabase
        .from('instance_features')
        .select('enabled, parameters')
        .eq('instance_id', instanceId)
        .eq('feature_key', 'sms_edit_link')
        .maybeSingle();
      
      // Determine if edit link should be included
      let includeEditLink = false;
      if (smsEditLinkFeature?.enabled) {
        const params = smsEditLinkFeature.parameters as { phones?: string[] } | null;
        if (!params || !params.phones || params.phones.length === 0) {
          includeEditLink = true;
        } else {
          let normalizedPhone = reservation.customer_phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
          if (!normalizedPhone.startsWith("+")) {
            normalizedPhone = "+48" + normalizedPhone;
          }
          includeEditLink = params.phones.some(p => {
            let normalizedAllowed = p.replace(/\s+/g, "").replace(/[^\d+]/g, "");
            if (!normalizedAllowed.startsWith("+")) {
              normalizedAllowed = "+48" + normalizedAllowed;
            }
            return normalizedPhone === normalizedAllowed;
          });
        }
      }

      // Format date for SMS
      const monthNamesFull = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'wrzesnia', 'pazdziernika', 'listopada', 'grudnia'];
      const dateObj = new Date(reservation.reservation_date);
      const dayNum = dateObj.getDate();
      const monthNameFull = monthNamesFull[dateObj.getMonth()];

      const instName = instData.short_name || instData.name || 'Myjnia';
      const mapsLink = instData.google_maps_url ? ` Dojazd: ${instData.google_maps_url}` : '';
      const reservationUrl = `https://${instData.slug}.n2wash.com/res?code=${reservation.confirmation_code}`;
      const editLink = includeEditLink ? ` Zmien lub anuluj: ${reservationUrl}` : '';
      
      const smsMessage = `${instName}: Rezerwacja potwierdzona! ${dayNum} ${monthNameFull} o ${reservation.start_time.slice(0,5)}.${mapsLink}${editLink}`;

      await supabase.functions.invoke('send-sms-message', {
        body: {
          phone: reservation.customer_phone,
          message: smsMessage,
          instanceId
        }
      });

      // Save confirmation SMS sent timestamp to DB
      await supabase
        .from('reservations')
        .update({ confirmation_sms_sent_at: now })
        .eq('id', reservationId);
      
      toast.success(t('reservations.confirmationSmsSent', { customerName: reservation.customer_name }));
    } catch (error) {
      console.error('SMS error:', error);
      // Rollback optimistic update on error
      setReservations(prev => prev.map(r => r.id === reservationId ? {
        ...r,
        confirmation_sms_sent_at: reservation.confirmation_sms_sent_at
      } : r));
      setSelectedReservation(prev => prev && prev.id === reservationId ? {
        ...prev,
        confirmation_sms_sent_at: reservation.confirmation_sms_sent_at
      } : prev);
      toast.error(t('errors.generic'));
    }
  };

  const handleRevertToConfirmed = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const {
      error: updateError
    } = await supabase.from('reservations').update({
      status: 'confirmed',
      started_at: null,
      completed_at: null
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
      status: 'in_progress',
      completed_at: null,
      released_at: null
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

  // Generic status change - allows jumping to any status
  const handleStatusChange = async (reservationId: string, newStatus: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const updateData: Record<string, any> = { status: newStatus };
    
    // Reset timestamps appropriately based on target status
    if (newStatus === 'confirmed') {
      updateData.started_at = null;
      updateData.completed_at = null;
      updateData.released_at = null;
    } else if (newStatus === 'in_progress') {
      updateData.completed_at = null;
      updateData.released_at = null;
    } else if (newStatus === 'completed') {
      updateData.released_at = null;
    }
    
    const { error: updateError } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId);
    
    if (updateError) {
      toast.error(t('errors.generic'));
      console.error('Update error:', updateError);
      return;
    }

    setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status: newStatus } : r));
    toast.success(t('reservations.statusChanged'));
  };

  const handleApproveChangeRequest = async (changeRequestId: string) => {
    const changeRequest = reservations.find(r => r.id === changeRequestId);
    if (!changeRequest || !instanceId) return;
    
    const originalId = (changeRequest as any).original_reservation_id;
    if (!originalId) {
      toast.error(t('errors.generic'));
      return;
    }

    // Get original reservation
    const { data: originalReservation, error: fetchError } = await supabase
      .from('reservations')
      .select('confirmation_code, reservation_date, start_time')
      .eq('id', originalId)
      .single();

    if (fetchError || !originalReservation) {
      toast.error(t('errors.generic'));
      return;
    }

    // Swap confirmation codes - new takes original's code
    const originalCode = originalReservation.confirmation_code;
    const newCode = changeRequest.confirmation_code;
    const tempCode = `TEMP_${Date.now()}`;

    // Step 1: Change original's code to temp (to avoid unique constraint conflict)
    const { error: tempError } = await supabase
      .from('reservations')
      .update({ confirmation_code: tempCode })
      .eq('id', originalId);

    if (tempError) {
      console.error('Error setting temp code:', tempError);
      toast.error(t('errors.generic'));
      return;
    }

    // Step 2: Update change request: set original's code, clear link, set to confirmed
    const { error: updateNewError } = await supabase
      .from('reservations')
      .update({
        confirmation_code: originalCode,
        original_reservation_id: null,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', changeRequestId);

    if (updateNewError) {
      console.error('Error updating change request:', updateNewError);
      toast.error(t('errors.generic'));
      return;
    }

    // Step 3: Cancel original reservation with the new code
    const { error: cancelError } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        confirmation_code: newCode
      })
      .eq('id', originalId);

    if (cancelError) {
      console.error('Error cancelling original:', cancelError);
    }

    // Send SMS to customer with new optimized format
    try {
      const dateFormatted = format(new Date(changeRequest.reservation_date), 'd MMMM', { locale: pl });
      const timeFormatted = changeRequest.start_time.slice(0, 5);
      const manageUrl = `https://${instanceData?.slug || 'demo'}.n2wash.com/res?code=${originalCode}`;
      
      // Use short_name if available, fallback to name
      const instanceName = instanceData?.short_name || instanceData?.name || 'Myjnia';
      const smsMessage = `${instanceName}: Potwierdzamy nowy termin: ${dateFormatted} o ${timeFormatted}. Zmien lub anuluj: ${manageUrl}`;
      
      await supabase.functions.invoke('send-sms-message', {
        body: {
          phone: changeRequest.customer_phone,
          message: smsMessage,
          instanceId
        }
      });
    } catch (smsError) {
      console.error('SMS error:', smsError);
    }

    // Update local state
    setReservations(prev => prev
      .filter(r => r.id !== originalId)
      .map(r => r.id === changeRequestId ? {
        ...r,
        confirmation_code: originalCode,
        status: 'confirmed',
        original_reservation_id: null
      } as any : r)
    );

    toast.success(t('myReservation.changeApproved'), {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    });
  };

  // Reject change request - delete request, keep original
  const handleRejectChangeRequest = async (changeRequestId: string) => {
    const changeRequest = reservations.find(r => r.id === changeRequestId);
    if (!changeRequest || !instanceId) return;
    
    const originalId = (changeRequest as any).original_reservation_id;

    // Get original reservation for SMS
    let originalReservation: any = null;
    if (originalId) {
      const { data } = await supabase
        .from('reservations')
        .select('reservation_date, start_time, confirmation_code')
        .eq('id', originalId)
        .single();
      originalReservation = data;
    }

    // Delete the change request
    const { error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .eq('id', changeRequestId);

    if (deleteError) {
      toast.error(t('errors.generic'));
      return;
    }

    // Send SMS to customer with new optimized format
    if (originalReservation) {
      try {
        const dateFormatted = format(new Date(originalReservation.reservation_date), 'd MMMM', { locale: pl });
        const timeFormatted = originalReservation.start_time.slice(0, 5);
        const manageUrl = `https://${instanceData?.slug || 'demo'}.n2wash.com/res?code=${originalReservation.confirmation_code}`;
        
        // Use short_name if available, fallback to name
        const instanceName = instanceData?.short_name || instanceData?.name || 'Myjnia';
        const smsMessage = `${instanceName}: Niestety nie mozemy zmienic terminu rezerwacji: ${dateFormatted} o ${timeFormatted}. Wybierz inny lub anuluj: ${manageUrl}`;
        
        await supabase.functions.invoke('send-sms-message', {
          body: {
            phone: changeRequest.customer_phone,
            message: smsMessage,
            instanceId
          }
        });
      } catch (smsError) {
        console.error('SMS error:', smsError);
      }
    }

    // Update local state
    setReservations(prev => prev.filter(r => r.id !== changeRequestId));

    toast.success(t('myReservation.changeRejected'));
  };

  const handleNoShow = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation || !instanceId) return;

    // Save customer data before updating
    await supabase.from('customers').upsert({
      instance_id: instanceId,
      name: reservation.customer_name,
      phone: reservation.customer_phone,
      source: 'myjnia',
    }, {
      onConflict: 'instance_id,source,phone',
      ignoreDuplicates: false
    });

    const { error } = await supabase.from('reservations').update({
      status: 'no_show',
      no_show_at: new Date().toISOString()
    }).eq('id', reservationId);

    if (error) {
      toast.error(t('errors.generic'));
      console.error('Error marking no-show:', error);
      return;
    }

    // Update local state - remove from visible list (no_show hides from calendar)
    setReservations(prev => prev.filter(r => r.id !== reservationId));
    setSelectedReservation(null);
    toast.success(t('reservations.noShowMarked'));
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

    // Mark as locally updated to prevent realtime from overwriting
    markAsLocallyUpdated(reservationId);

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
    
    // Default car size to 'medium' if not set
    const effectiveCarSize = vehicle.car_size || 'medium';
    
    // Calculate total duration based on services
    let totalDuration = 60; // Default 1 hour if no services
    
    if (vehicle.service_ids && vehicle.service_ids.length > 0) {
      totalDuration = vehicle.service_ids.reduce((total, serviceId) => {
        const service = allServices.find(s => s.id === serviceId);
        if (!service) {
          console.warn(`Service ${serviceId} not found in allServices`);
          return total;
        }
        
        // Get duration based on car size (with fallback chain)
        let duration = 0;
        if (effectiveCarSize === 'small') {
          duration = service.duration_small || service.duration_medium || service.duration_minutes || 60;
        } else if (effectiveCarSize === 'large') {
          duration = service.duration_large || service.duration_medium || service.duration_minutes || 60;
        } else {
          // medium or fallback
          duration = service.duration_medium || service.duration_minutes || 60;
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
        admin_notes: vehicle.notes,
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
                  </div>}
              </button>
            </div>

            {/* Navigation */}
            <nav className={cn("flex-1 space-y-2", sidebarCollapsed ? "p-2" : "p-4")}>
              <Button variant={currentView === 'calendar' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('calendar'), 50); }} title="Kalendarz">
                <Calendar className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Kalendarz"}
              </Button>
              <Button variant={currentView === 'reservations' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('reservations'), 50); }} title="Rezerwacje">
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
              <Button variant={currentView === 'notifications' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('notifications'), 50); }} title="Powiadomienia">
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
              <Button variant={currentView === 'customers' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('customers'), 50); }} title="Klienci">
                <UserCircle className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Klienci"}
              </Button>
              {hasFeature('offers') && <Button variant={currentView === 'offers' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('offers'), 50); }} title="Oferty">
                  <FileText className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Oferty"}
                </Button>}
              {/* Products and Follow-up hidden for now */}
              {/* {hasFeature('offers') && <Button variant={currentView === 'products' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('products'), 50); }} title="Produkty">
                  <Package className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Produkty"}
                </Button>}
              {hasFeature('followup') && <Button variant={currentView === 'followup' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('followup'), 50); }} title="Follow-up">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && "Follow-up"}
                </Button>} */}
              {/* Hide settings for employees */}
              {userRole !== 'employee' && <Button variant={currentView === 'settings' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('settings'), 50); }} title="Ustawienia">
                <Settings className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Ustawienia"}
              </Button>}
              {/* Halls - visible when feature is enabled and user is admin */}
              {hasFeature('hall_view') && userRole !== 'employee' && <Button variant={currentView === 'halls' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('halls'), 50); }} title={t('navigation.halls')}>
                <Building2 className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && t('navigation.halls')}
              </Button>}
              {/* Protocols - visible when feature is enabled */}
              {hasFeature('vehicle_reception_protocol') && userRole !== 'employee' && <Button variant={currentView === 'protocols' ? 'secondary' : 'ghost'} className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")} onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('protocols'), 50); }} title="Protokoły">
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && "Protokoły"}
              </Button>}
            </nav>

            {/* Update banner & Collapse toggle & User menu */}
            <div className={cn(sidebarCollapsed ? "p-2 space-y-2" : "p-4 space-y-3")}>
              {/* Update available banner */}
              <UpdateBanner collapsed={sidebarCollapsed} />

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

              {/* Divider between collapse button and user menu */}
              {!sidebarCollapsed && <Separator className="my-3 -mx-4 w-[calc(100%+2rem)] bg-border/30" />}

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
                        <span className="text-sm truncate">{username || user.email}</span>
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

          {/* Content */}
          <div className={cn(
            "flex-1 space-y-6 overflow-auto pb-20 lg:pb-8",
            currentView === 'calendar' ? "p-0 lg:p-4 lg:pt-0" : "p-4"
          )}>
            {/* Header - only shown for non-calendar views that need it */}
            {['reservations', 'customers', 'settings'].includes(currentView) && <h1 className="text-2xl font-bold text-foreground">
                {currentView === 'reservations' ? t('reservations.title') : currentView === 'customers' ? t('customers.title') : t('settings.title')}
              </h1>}

            {/* Free Time Ranges Per Station - Hidden on desktop, shown via bottom sheet on mobile */}

            {/* View Content */}
            {currentView === 'calendar' && <div className="flex-1 min-h-[600px] h-full relative">
                <AdminCalendar stations={stations} reservations={reservations} breaks={breaks} closedDays={closedDays} workingHours={workingHours} onReservationClick={handleReservationClick} onAddReservation={handleAddReservation} onAddBreak={handleAddBreak} onDeleteBreak={handleDeleteBreak} onToggleClosedDay={handleToggleClosedDay} onReservationMove={handleReservationMove} onConfirmReservation={handleConfirmReservation} onYardVehicleDrop={handleYardVehicleDrop} onDateChange={handleCalendarDateChange} instanceId={instanceId || undefined} yardVehicleCount={yardVehicleCount} selectedReservationId={selectedReservation?.id || editingReservation?.id} slotPreview={slotPreview} isLoadingMore={isLoadingMoreReservations} />
                
                {/* FAB removed - plus button is now in MobileBottomNav */}
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
                onWorkingHoursUpdate={fetchWorkingHours}
              />
            )}

            {currentView === 'offers' && <OffersView instanceId={instanceId} instanceData={instanceData} onNavigateToProducts={() => setCurrentView('products')} />}

            {currentView === 'products' && <ProductsView instanceId={instanceId} onBackToOffers={() => setCurrentView('offers')} />}

            {currentView === 'followup' && <FollowUpView instanceId={instanceId} />}

            {currentView === 'notifications' && <NotificationsView 
              instanceId={instanceId} 
              onNavigateBack={() => setCurrentView('calendar')} 
              onNavigateToOffers={() => setCurrentView('offers')}
              onNavigateToReservations={() => setCurrentView('reservations')}
              onReservationClick={handleReservationClick}
            />}

            {currentView === 'halls' && instanceId && <HallsListView instanceId={instanceId} />}

            {currentView === 'protocols' && instanceId && <ProtocolsView instanceId={instanceId} />}
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
        onNoShow={handleNoShow}
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
        onApproveChangeRequest={async id => {
          await handleApproveChangeRequest(id);
          setSelectedReservation(null);
        }}
        onRejectChangeRequest={async id => {
          await handleRejectChangeRequest(id);
          setSelectedReservation(null);
        }}
        onStatusChange={async (id, status) => {
          await handleStatusChange(id, status);
          setSelectedReservation(null);
        }}
        onSendPickupSms={handleSendPickupSms}
        onSendConfirmationSms={handleSendConfirmationSms}
      />

      {/* Add/Edit Reservation Dialog V2 */}
      {instanceId && (
        <AddReservationDialogV2
          open={addReservationOpen || addReservationV2Open}
          onClose={() => {
            setAddReservationOpen(false);
            setAddReservationV2Open(false);
            setEditingReservation(null);
            setSlotPreview(null);
          }}
          onSlotPreviewChange={handleSlotPreviewChange}
          instanceId={instanceId}
          onSuccess={handleReservationAdded}
          workingHours={workingHours}
          mode={
            newReservationData.stationType === 'ppf' ? 'ppf' 
            : newReservationData.stationType === 'detailing' ? 'detailing' 
            : 'reservation'
          }
          stationId={newReservationData.stationId}
          initialDate={newReservationData.date}
          initialTime={newReservationData.time}
          initialStationId={newReservationData.stationId}
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
            admin_notes: (editingReservation as any).admin_notes,
            price: editingReservation.price,
          } : null}
          currentUsername={username}
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
        onAddReservation={handleQuickAddReservation} 
        onLogout={handleLogout}
        unreadNotificationsCount={unreadNotificationsCount}
        offersEnabled={hasFeature('offers')}
        followupEnabled={hasFeature('followup')}
        hallViewEnabled={hasFeature('hall_view')}
        userRole={userRole}
        currentVersion={currentVersion}
      />
    </>;
};
export default AdminDashboard;