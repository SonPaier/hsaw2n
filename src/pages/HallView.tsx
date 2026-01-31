import { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AdminCalendar from '@/components/admin/AdminCalendar';
import HallReservationCard from '@/components/admin/halls/HallReservationCard';
import AddReservationDialogV2 from '@/components/admin/AddReservationDialogV2';
import { ProtocolsView } from '@/components/protocols/ProtocolsView';
import { useInstancePlan } from '@/hooks/useInstancePlan';
import { useBreaks } from '@/hooks/useBreaks';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useUnifiedServices } from '@/hooks/useUnifiedServices';
import { Loader2, Calendar, FileText, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Hall } from '@/components/admin/halls/HallCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { normalizePhone } from '@/lib/phoneUtils';
import { compressImage } from '@/lib/imageUtils';
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
  service_items?: Array<{ service_id: string; custom_price: number | null; name?: string; id?: string }>;
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
  admin_notes?: string | null;
  photo_urls?: string[] | null;
  checked_service_ids?: string[] | null;
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
  
  // Derive instanceId from auth roles (avoid duplicate fetch)
  const derivedInstanceId = useMemo(() => {
    const adminRole = roles.find(r => r.role === 'admin' && r.instance_id);
    if (adminRole?.instance_id) return adminRole.instance_id;
    const employeeRole = roles.find(r => r.role === 'employee' && r.instance_id);
    if (employeeRole?.instance_id) return employeeRole.instance_id;
    const hallRole = roles.find(r => r.role === 'hall' && r.instance_id);
    if (hallRole?.instance_id) return hallRole.instance_id;
    return null;
  }, [roles]);
  
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [hall, setHall] = useState<Hall | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [yardVehicleCount, setYardVehicleCount] = useState(0);
  const [hallDataVisible, setHallDataVisible] = useState(true);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [showProtocolsList, setShowProtocolsList] = useState(false);
  const [instanceShortName, setInstanceShortName] = useState<string>('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photosTargetReservation, setPhotosTargetReservation] = useState<Reservation | null>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  // CACHED HOOKS - using React Query with staleTime for static data
  const { data: cachedBreaks = [] } = useBreaks(instanceId);
  const { data: cachedWorkingHours } = useWorkingHours(instanceId);
  const { data: cachedServices = [] } = useUnifiedServices(instanceId);
  
  // Use cached data
  const breaks = cachedBreaks as Break[];
  const workingHours = cachedWorkingHours;
  const servicesMap = useMemo(() => {
    const map = new Map<string, string>();
    cachedServices.forEach(s => map.set(s.id, s.name));
    return map;
  }, [cachedServices]);

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

  // Helper to find customer email for protocol
  const findCustomerEmail = async (phone: string): Promise<string | null> => {
    if (!instanceId || !phone) return null;
    
    const normalized = normalizePhone(phone);
    
    // Check customers table
    const { data: customer } = await supabase
      .from('customers')
      .select('email')
      .eq('instance_id', instanceId)
      .or(`phone.eq.${normalized},phone.eq.+48${normalized}`)
      .maybeSingle();
    
    if (customer?.email) return customer.email;
    
    // Check offers table
    const { data: offers } = await supabase
      .from('offers')
      .select('customer_data')
      .eq('instance_id', instanceId)
      .not('customer_data', 'is', null)
      .limit(10);
    
    for (const offer of offers || []) {
      const customerData = offer.customer_data as any;
      if (normalizePhone(customerData?.phone) === normalized && customerData?.email) {
        return customerData.email;
      }
    }
    
    return null;
  };

  // Handle adding protocol from reservation
  const handleAddProtocol = (reservation: Reservation) => {
    void (async () => {
      const email = await findCustomerEmail(reservation.customer_phone);

      const params = new URLSearchParams({
        action: 'new',
        reservationId: reservation.id,
        customerName: reservation.customer_name || '',
        customerPhone: reservation.customer_phone || '',
        vehiclePlate: reservation.vehicle_plate || '',
      });
      if (email) params.set('email', email);

      setSelectedReservation(null);

      // Same behaviour as ReservationDetailsDrawer: go to Protocols view and let it open the Create form from URL.
      const protocolsPath = isAdminPath ? '/admin/protocols' : '/protocols';
      navigate(`${protocolsPath}?${params.toString()}`);
    })();
  };

  // Handle adding photos to reservation - directly trigger file input
  const handleAddPhotos = (reservation: Reservation) => {
    setPhotosTargetReservation(reservation);
    setSelectedReservation(null);
    // Trigger file input after state update
    setTimeout(() => {
      photosInputRef.current?.click();
    }, 100);
  };

  // Handle photo file selection and upload
  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !photosTargetReservation) {
      setPhotosTargetReservation(null);
      return;
    }

    const maxPhotos = 8;
    const currentPhotos = photosTargetReservation.photo_urls || [];
    const remainingSlots = maxPhotos - currentPhotos.length;

    if (remainingSlots <= 0) {
      toast.error(`Maksymalna liczba zdjęć: ${maxPhotos}`);
      setPhotosTargetReservation(null);
      if (photosInputRef.current) photosInputRef.current.value = '';
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingPhotos(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        const compressed = await compressImage(file, 1200, 0.8);
        const fileName = `reservation-${photosTargetReservation.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('reservation-photos')
          .upload(fileName, compressed, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('reservation-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      }

      const newPhotos = [...currentPhotos, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from('reservations')
        .update({ photo_urls: newPhotos })
        .eq('id', photosTargetReservation.id);

      if (updateError) throw updateError;

      // Update local state
      setReservations(prev => prev.map(r => 
        r.id === photosTargetReservation.id ? { ...r, photo_urls: newPhotos } : r
      ));

      toast.success(`Dodano ${uploadedUrls.length} zdjęć`);
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Błąd podczas przesyłania zdjęć');
    } finally {
      setUploadingPhotos(false);
      setPhotosTargetReservation(null);
      if (photosInputRef.current) photosInputRef.current.value = '';
    }
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

  // Set instanceId from auth roles (avoid duplicate fetch)
  useEffect(() => {
    if (derivedInstanceId) {
      setInstanceId(derivedInstanceId);
      return;
    }
    
    // Fallback for super_admin - need to fetch first instance
    const fetchSuperAdminInstance = async () => {
      if (!user) return;
      const isSuperAdmin = roles.some(r => r.role === 'super_admin');
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
    
    fetchSuperAdminInstance();
  }, [user, roles, derivedInstanceId]);

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

  // Fetch data - only stations, reservations, and instance short_name (breaks, workingHours, services from hooks)
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

      // Fetch instance short_name only (working_hours comes from hook)
      const { data: instanceData } = await supabase
        .from('instances')
        .select('short_name')
        .eq('id', instanceId)
        .maybeSingle();

      if (instanceData?.short_name) {
        setInstanceShortName(instanceData.short_name);
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
          admin_notes,
          photo_urls,
          checked_service_ids,
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
          admin_notes: r.admin_notes,
          checked_service_ids: Array.isArray(r.checked_service_ids) ? r.checked_service_ids as string[] : null,
        })));
      }

      // Fetch yard vehicles count (lazy-loaded)
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
              service_ids,
              admin_notes,
              has_unified_services,
              photo_urls,
              checked_service_ids,
              stations:station_id (name, type)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const newReservation = {
                  ...data,
                  status: data.status || 'pending',
                  service_ids: Array.isArray(data.service_ids) ? data.service_ids as string[] : undefined,
                  service: undefined, // Legacy relation removed
                  station: data.stations ? { name: (data.stations as any).name, type: (data.stations as any).type } : undefined,
                  admin_notes: data.admin_notes,
                  has_unified_services: data.has_unified_services,
                };
                setReservations(prev => [...prev, newReservation as Reservation]);
                
                const isCustomerReservation = (data as any).source === 'customer';
                toast.success(isCustomerReservation ? `🔔 ${t('notifications.newReservation')}!` : `${t('notifications.newReservation')}!`, {
                  description: `${data.start_time.slice(0, 5)} - ${data.vehicle_plate}`
                });
              }
            });
        } else if (payload.eventType === 'UPDATE') {
          // Fetch full data from server to ensure complete object (including photo_urls)
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
              service_ids,
              service_items,
              admin_notes,
              has_unified_services,
              photo_urls,
              checked_service_ids,
              stations:station_id (name, type)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const updatedReservation = {
                  ...data,
                  status: data.status || 'pending',
                  service_ids: Array.isArray(data.service_ids) ? data.service_ids as string[] : undefined,
                  service_items: Array.isArray(data.service_items) ? data.service_items as unknown as Array<{ service_id: string; custom_price: number | null }> : undefined,
                  service: undefined,
                  station: data.stations ? { name: (data.stations as any).name, type: (data.stations as any).type } : undefined,
                  admin_notes: data.admin_notes,
                  has_unified_services: data.has_unified_services,
                  checked_service_ids: Array.isArray(data.checked_service_ids) ? data.checked_service_ids as string[] : null,
                };
                setReservations(prev => prev.map(r => r.id === data.id ? updatedReservation as Reservation : r));
                // Also update selectedReservation if it's the same
                setSelectedReservation(prev => 
                  prev?.id === data.id ? updatedReservation as Reservation : prev
                );
              }
            });
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
    // Also update selectedReservation if it's the same
    setSelectedReservation(prev => 
      prev?.id === reservationId ? { ...prev, status: newStatus } : prev
    );
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

  // Send pickup SMS handler for hall view
  const handleSendPickupSms = async (reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation || !instanceId) return;

    const message = `${instanceShortName || 'Serwis'}: Twoje auto jest gotowe do odbioru. Zapraszamy!`;

    const { error } = await supabase.functions.invoke('send-sms-message', {
      body: {
        phone: reservation.customer_phone,
        message,
        instanceId,
      },
    });

    if (error) {
      toast.error(t('common.error'));
      return;
    }

    toast.success(t('reservations.pickupSmsSent', { customerName: reservation.customer_name }));
  };

  // Map all reservations with services_data for calendar display (including service id for toggle)
  // Primary source: service_items JSONB (already contains names), fallback to servicesMap
  const reservationsWithServices = useMemo(() => {
    return reservations.map(reservation => {
      // Use service_items as primary source (has names embedded)
      const serviceItems = reservation.service_items as any[] | undefined;
      if (serviceItems && serviceItems.length > 0) {
        return {
          ...reservation,
          services_data: serviceItems.map(item => ({
            id: item.id || item.service_id,
            name: item.name || 'Usługa',
          })),
        };
      }
      // Fallback to service_ids lookup
      return {
        ...reservation,
        services_data: reservation.service_ids?.map(id => ({
          id,
          name: servicesMap.get(id) || 'Usługa',
        })) || [],
      };
    });
  }, [reservations, servicesMap]);

  // Map selected reservation with services_data (including service id for toggle)
  // Primary source: service_items JSONB
  const selectedReservationWithServices = useMemo(() => {
    if (!selectedReservation) return null;
    
    // Use service_items as primary source (has names embedded)
    const serviceItems = selectedReservation.service_items as any[] | undefined;
    let services_data: Array<{ id: string; name: string }>;
    
    if (serviceItems && serviceItems.length > 0) {
      services_data = serviceItems.map(item => ({
        id: item.id || item.service_id,
        name: item.name || 'Usługa',
      }));
    } else {
      services_data = selectedReservation.service_ids?.map(id => ({
        id,
        name: servicesMap.get(id) || 'Usługa',
      })) || [];
    }

    return {
      ...selectedReservation,
      services_data,
    };
  }, [selectedReservation, servicesMap]);

  // Handle service toggle (mark as done/undone)
  const handleServiceToggle = async (serviceId: string, checked: boolean) => {
    if (!selectedReservation) return;
    
    const currentChecked = selectedReservation.checked_service_ids || [];
    const newChecked = checked 
      ? [...currentChecked, serviceId]
      : currentChecked.filter(id => id !== serviceId);
    
    const { error } = await supabase
      .from('reservations')
      .update({ checked_service_ids: newChecked })
      .eq('id', selectedReservation.id);
    
    if (error) {
      toast.error(t('common.error'));
      return;
    }
    
    // Update local state
    setReservations(prev => prev.map(r => 
      r.id === selectedReservation.id ? { ...r, checked_service_ids: newChecked } : r
    ));
    setSelectedReservation(prev => 
      prev ? { ...prev, checked_service_ids: newChecked } : prev
    );
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
        service_items,
        has_unified_services,
        admin_notes,
        photo_urls,
        checked_service_ids,
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
        admin_notes: r.admin_notes,
        checked_service_ids: Array.isArray(r.checked_service_ids) ? r.checked_service_ids as string[] : null,
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

  // Render protocols with sidebar (like calendar view)
  if (showProtocolsList && instanceId) {
    return (
      <>
        <Helmet>
          <title>Protokoły | {hall?.name || t('hall.title')}</title>
        </Helmet>

        <div className="h-screen w-screen overflow-hidden bg-background flex">
          {/* Mini Sidebar for hall view - matching AdminDashboard sidebar styles */}
          <aside className="sticky top-0 inset-y-0 left-0 z-50 h-screen w-16 bg-card border-r border-border/50 flex-shrink-0">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Navigation */}
              <nav className="flex-1 space-y-2 p-2">
                {/* Calendar/Halls icon */}
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2"
                  onClick={() => setShowProtocolsList(false)}
                  title={t('navigation.calendar')}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                </Button>

                {/* Protocols icon - active */}
                <Button
                  variant="secondary"
                  className="w-full justify-center px-2"
                  title={t('navigation.protocols')}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                </Button>
              </nav>

              {/* Logout button at bottom */}
              <div className="p-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2 text-muted-foreground hover:text-foreground"
                  onClick={handleLogout}
                  title={t('auth.logout')}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                </Button>
              </div>
            </div>
          </aside>

          {/* Protocols content */}
          <div className="flex-1 h-full overflow-auto">
            <ProtocolsView 
              instanceId={instanceId} 
              kioskMode={true}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{hall?.name || t('hall.title')} | {t('hall.employeePanel')}</title>
      </Helmet>

      <div className="h-screen w-screen overflow-hidden bg-background flex">
        {/* Mini Sidebar for hall view - matching AdminDashboard sidebar styles */}
        <aside className="sticky top-0 inset-y-0 left-0 z-50 h-screen w-16 bg-card border-r border-border/50 flex-shrink-0">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Navigation */}
            <nav className="flex-1 space-y-2 p-2">
              {/* Calendar/Halls icon */}
              <Button
                variant={!showProtocolsList ? 'secondary' : 'ghost'}
                className="w-full justify-center px-2"
                onClick={handleCalendarNavigation}
                title={t('navigation.calendar')}
              >
                <Calendar className="w-4 h-4 shrink-0" />
              </Button>

              {/* Protocols icon */}
              {canAccessProtocols && (
                <Button
                  variant={showProtocolsList ? 'secondary' : 'ghost'}
                  className="w-full justify-center px-2"
                  onClick={handleProtocolsNavigation}
                  title={t('navigation.protocols')}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                </Button>
              )}
            </nav>

            {/* Logout button at bottom */}
            <div className="p-2 border-t border-border/50">
              <Button
                variant="ghost"
                className="w-full justify-center px-2 text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
                title={t('auth.logout')}
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 h-full overflow-hidden">
          <AdminCalendar
            stations={stations}
            reservations={reservationsWithServices}
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

      {selectedReservationWithServices && (
        <HallReservationCard
          reservation={selectedReservationWithServices}
          open={!!selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onStartWork={async (id) => {
            const { error } = await supabase.from('reservations').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', id);
            if (!error) {
              handleStatusChange(id, 'in_progress');
            } else {
              toast.error(t('common.error'));
            }
          }}
          onEndWork={async (id) => {
            const { error } = await supabase.from('reservations').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
            if (!error) {
              handleStatusChange(id, 'completed');
            } else {
              toast.error(t('common.error'));
            }
          }}
          onSendPickupSms={handleSendPickupSms}
          onAddProtocol={canAccessProtocols ? handleAddProtocol : undefined}
          onAddPhotos={handleAddPhotos}
          onServiceToggle={handleServiceToggle}
        />
      )}

      {/* Hidden file input for direct photo capture */}
      <input
        ref={photosInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={handlePhotoFileSelect}
        className="hidden"
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
