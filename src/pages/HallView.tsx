import { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AdminCalendar from '@/components/admin/AdminCalendar';
import HallReservationCard from '@/components/admin/halls/HallReservationCard';
import AddReservationDialogV2 from '@/components/admin/AddReservationDialogV2';
import ServiceSelectionDrawer from '@/components/admin/ServiceSelectionDrawer';
import type { ServiceWithCategory } from '@/components/admin/ServiceSelectionDrawer';
import { ProtocolsView } from '@/components/protocols/ProtocolsView';
import { EmployeesList } from '@/components/admin/employees';
import { useInstancePlan } from '@/hooks/useInstancePlan';
import { useBreaks } from '@/hooks/useBreaks';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useUnifiedServices } from '@/hooks/useUnifiedServices';
import { useServiceDictionary, buildServicesMapFromDictionary } from '@/hooks/useServiceDictionary';
import { Loader2, Calendar, FileText, LogOut, Users } from 'lucide-react';
import { TrainingDetailsDrawer } from '@/components/admin/TrainingDetailsDrawer';
import type { Training } from '@/components/admin/AddTrainingDrawer';
import { useCombinedFeatures } from '@/hooks/useCombinedFeatures';
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
  color?: string | null;
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
  service_items?: Array<{ service_id: string; custom_price: number | null; name?: string; id?: string; short_name?: string }>;
  service?: {
    name: string;
    shortcut?: string | null;
  };
  services_data?: Array<{
    id?: string;
    name: string;
    shortcut?: string | null;
  }>;
  station?: {
    name: string;
    type?: 'washing' | 'ppf' | 'detailing' | 'universal';
  };
  price: number | null;
  has_unified_services?: boolean | null;
  admin_notes?: string | null;
  photo_urls?: string[] | null;
  checked_service_ids?: string[] | null;
  assigned_employee_ids?: string[] | null;
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
  const [showWorkersList, setShowWorkersList] = useState(false);
  const [instanceShortName, setInstanceShortName] = useState<string>('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photosTargetReservation, setPhotosTargetReservation] = useState<Reservation | null>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  
  // Service drawer state for hall view
  const [serviceDrawerReservation, setServiceDrawerReservation] = useState<Reservation | null>(null);

  // Trainings state
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [trainingDetailsOpen, setTrainingDetailsOpen] = useState(false);

  // CACHED HOOKS - using React Query with staleTime for static data
  const { data: cachedBreaks = [] } = useBreaks(instanceId);
  const { data: cachedWorkingHours } = useWorkingHours(instanceId);
  const { data: cachedServices = [] } = useUnifiedServices(instanceId);
  const { map: serviceDictMap } = useServiceDictionary(instanceId);
  
  // Use cached data
  const breaks = cachedBreaks as Break[];
  const workingHours = cachedWorkingHours;
  const servicesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, s] of serviceDictMap) {
      map.set(id, s.name);
    }
    return map;
  }, [serviceDictMap]);

  // Check if user has hall role (kiosk mode)
  const hasHallRole = roles.some(r => r.role === 'hall');
  const hasAdminOrEmployeeRole = roles.some(r => r.role === 'admin' || r.role === 'employee');
  const effectiveKioskMode = isKioskMode || hasHallRole;

  // Check if we're on /admin/... path
  const isAdminPath = location.pathname.startsWith('/admin');

  // Check subscription plan for protocols access
  const { hasFeature, planSlug } = useInstancePlan(instanceId);
  const canAccessProtocols = hasFeature('vehicle_reception_protocol') || planSlug === 'detailing';

  // Combined features (includes plan + instance features)
  const { hasFeature: hasCombinedFeature } = useCombinedFeatures(instanceId);
  const trainingsEnabled = hasCombinedFeature('trainings');

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
    setShowWorkersList(false);
  };

  const handleWorkersNavigation = () => {
    setShowWorkersList(true);
    setShowProtocolsList(false);
  };

  const handleCalendarFromSidebar = () => {
    setShowProtocolsList(false);
    setShowWorkersList(false);
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

  // Handle adding services to reservation from drawer (hall view)
  const handleAddServicesToReservation = async (newServiceIds: string[], servicesData: ServiceWithCategory[]) => {
    if (!serviceDrawerReservation) return;
    
    const currentIds = serviceDrawerReservation.service_ids || [];
    const mergedIds = [...new Set([...currentIds, ...newServiceIds])];
    
    // Build full service_items with metadata
    const existingItems = serviceDrawerReservation.service_items || [];
    const newItems = newServiceIds
      .filter(id => !currentIds.includes(id))
      .map(id => {
        const svc = servicesData.find(s => s.id === id);
        return {
          service_id: id,
          name: svc?.name || 'Usługa',
          short_name: svc?.short_name || null,
          custom_price: null,
          price_small: svc?.price_small ?? null,
          price_medium: svc?.price_medium ?? null,
          price_large: svc?.price_large ?? null,
        };
      });
    
    const mergedItems = [...existingItems, ...newItems];
    
    const { error } = await supabase
      .from('reservations')
      .update({ service_ids: mergedIds, service_items: mergedItems })
      .eq('id', serviceDrawerReservation.id);
    
    if (error) {
      toast.error(t('common.error'));
      return;
    }
    
    // Update local state
    setReservations(prev => prev.map(r => {
      if (r.id !== serviceDrawerReservation.id) return r;
      
      // Also update services_data for display
      const newServicesData = newServiceIds
        .filter(id => !currentIds.includes(id))
        .map(id => {
          const svc = servicesData.find(s => s.id === id);
          return { id, name: svc?.name || 'Usługa', shortcut: svc?.short_name || null };
        });
      
      return {
        ...r,
        service_ids: mergedIds,
        service_items: mergedItems as any,
        services_data: [...(r.services_data || []), ...newServicesData],
      };
    }));
    
    // Update selected reservation if it's the same one
    if (selectedReservation?.id === serviceDrawerReservation.id) {
      setSelectedReservation(prev => {
        if (!prev) return prev;
        const newServicesData = newServiceIds
          .filter(id => !currentIds.includes(id))
          .map(id => {
            const svc = servicesData.find(s => s.id === id);
            return { id, name: svc?.name || 'Usługa', shortcut: svc?.short_name || null };
          });
        return {
          ...prev,
          service_ids: mergedIds,
          service_items: mergedItems as any,
          services_data: [...(prev.services_data || []), ...newServicesData],
        };
      });
    }
    
    toast.success(t('common.saved'));
  };

  // Handle removing service from reservation (hall view)
  const handleRemoveServiceFromReservation = async (serviceId: string) => {
    if (!selectedReservation) return;
    
    const currentIds = selectedReservation.service_ids || [];
    const updatedIds = currentIds.filter(id => id !== serviceId);
    const updatedItems = (selectedReservation.service_items || [])
      .filter(item => (item.service_id || (item as any).id) !== serviceId);
    
    const { error } = await supabase
      .from('reservations')
      .update({ 
        service_ids: updatedIds, 
        service_items: updatedItems.length > 0 ? updatedItems : null 
      })
      .eq('id', selectedReservation.id);
    
    if (error) {
      toast.error(t('common.error'));
      return;
    }
    
    // Update local state
    setReservations(prev => prev.map(r => {
      if (r.id !== selectedReservation.id) return r;
      return {
        ...r,
        service_ids: updatedIds,
        service_items: updatedItems.length > 0 ? updatedItems as any : undefined,
        services_data: r.services_data?.filter(s => s.id !== serviceId),
      };
    }));
    
    // Update selected reservation
    setSelectedReservation(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        service_ids: updatedIds,
        service_items: updatedItems.length > 0 ? updatedItems as any : undefined,
        services_data: prev.services_data?.filter(s => s.id !== serviceId),
      };
    });
    
    toast.success(t('common.saved'));
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
        .select('id, name, type, color')
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
        // Build services map from central dictionary
        const svcMap = buildServicesMapFromDictionary(serviceDictMap);
        
        setReservations(reservationsData.map(r => {
          // Map services_data using same logic as realtime
          const serviceItems = r.service_items as unknown as Array<{ service_id: string; custom_price: number | null; name?: string; id?: string; short_name?: string }> | null;
          const serviceIds = r.service_ids as string[] | null;
          
          let servicesDataMapped: Array<{ id?: string; name: string; shortcut?: string | null }> = [];
          
          if (serviceIds && serviceIds.length > 0) {
            const itemsById = new Map<string, any>();
            (serviceItems || []).forEach(item => {
              const resolvedId = item.id || item.service_id;
              if (resolvedId) itemsById.set(resolvedId, item);
            });

            servicesDataMapped = serviceIds.map(id => {
              const item = itemsById.get(id);
              const svc = svcMap.get(id);
              return {
                id,
                name: item?.name ?? svc?.name ?? 'Usługa',
                shortcut: item?.short_name ?? svc?.shortcut ?? null,
              };
            });
          } else if (serviceItems && serviceItems.length > 0) {
            const seen = new Set<string>();
            servicesDataMapped = serviceItems
              .map(item => {
                const resolvedId = item.id || item.service_id;
                const svc = resolvedId ? svcMap.get(resolvedId) : undefined;
                return {
                  id: resolvedId,
                  name: item.name ?? svc?.name ?? 'Usługa',
                  shortcut: item.short_name ?? svc?.shortcut ?? null,
                };
              })
              .filter(svc => {
                if (!svc.id) return false;
                if (seen.has(svc.id)) return false;
                seen.add(svc.id);
                return true;
              });
          }

          return {
            ...r,
            status: r.status || 'pending',
            service_ids: Array.isArray(r.service_ids) ? r.service_ids as string[] : undefined,
            service_items: Array.isArray(r.service_items) ? r.service_items as unknown as Array<{ service_id: string; custom_price: number | null }> : undefined,
            services_data: servicesDataMapped.length > 0 ? servicesDataMapped : undefined,
            service: undefined,
            station: r.stations ? { name: (r.stations as any).name, type: (r.stations as any).type } : undefined,
            has_unified_services: r.has_unified_services,
            admin_notes: r.admin_notes,
            checked_service_ids: Array.isArray(r.checked_service_ids) ? r.checked_service_ids as string[] : null,
          };
        }));
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
  }, [instanceId, hall, cachedServices]);

  // Fetch trainings
  useEffect(() => {
    if (!instanceId || !trainingsEnabled) {
      setTrainings([]);
      return;
    }
    const fetchTrainings = async () => {
      const { data } = await supabase
        .from('trainings')
        .select('*, stations:station_id (name, type), training_type_record:training_type_id (id, name, duration_days, sort_order, active, instance_id)')
        .eq('instance_id', instanceId) as any;
      if (data) {
        setTrainings(data.map((t: any) => ({
          ...t,
          assigned_employee_ids: Array.isArray(t.assigned_employee_ids) ? t.assigned_employee_ids : [],
        })));
      }
    };
    fetchTrainings();
  }, [instanceId, trainingsEnabled]);

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

  // Reference to services map for realtime updates (same pattern as AdminDashboard)
  const servicesMapRef = useRef<Map<string, { id: string; name: string; shortcut?: string | null }>>(new Map());
  
  // Update servicesMapRef when dictionary changes
  useEffect(() => {
    servicesMapRef.current = buildServicesMapFromDictionary(serviceDictMap);
  }, [serviceDictMap]);

  // Subscribe to realtime updates with polling fallback - SYNCED with AdminDashboard logic
  useEffect(() => {
    if (!instanceId) return;

    let pollInterval = 3000; // Initial poll interval 3s
    let pollTimeoutId: NodeJS.Timeout | null = null;
    let lastPollTimestamp: string | null = null;
    let realtimeWorking = false;
    let retryCount = 0;
    const maxRetries = 10;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let isCleanedUp = false;

    // Map helper for reservations - SAME LOGIC AS AdminDashboard
    const mapReservationData = (data: any): Reservation => {
      // Primary source: service_items JSONB (already contains names)
      const serviceItems = data.service_items as unknown as Array<{ service_id: string; custom_price: number | null; name?: string; id?: string; short_name?: string }> | null;
      const serviceIds = data.service_ids as string[] | null;
      
      let servicesDataMapped: Array<{ id?: string; name: string; shortcut?: string | null }> = [];
      
      // Canonical list of selected services is `service_ids`
      if (serviceIds && serviceIds.length > 0) {
        const itemsById = new Map<string, any>();
        (serviceItems || []).forEach(item => {
          const resolvedId = item.id || item.service_id;
          if (resolvedId) itemsById.set(resolvedId, item);
        });

        servicesDataMapped = serviceIds.map(id => {
          const item = itemsById.get(id);
          const svc = servicesMapRef.current.get(id);

          return {
            id,
            name: item?.name ?? svc?.name ?? 'Usługa',
            shortcut: item?.short_name ?? svc?.shortcut ?? null,
          };
        });
      } else if (serviceItems && serviceItems.length > 0) {
        // Fallback: no service_ids, use service_items directly
        const seen = new Set<string>();
        servicesDataMapped = serviceItems
          .map(item => {
            const resolvedId = item.id || item.service_id;
            const svc = resolvedId ? servicesMapRef.current.get(resolvedId) : undefined;
            return {
              id: resolvedId,
              name: item.name ?? svc?.name ?? 'Usługa',
              shortcut: item.short_name ?? svc?.shortcut ?? null,
            };
          })
          .filter(svc => {
            if (!svc.id) return false;
            if (seen.has(svc.id)) return false;
            seen.add(svc.id);
            return true;
          });
      }

      return {
        ...data,
        status: data.status || 'pending',
        service_ids: Array.isArray(data.service_ids) ? data.service_ids as string[] : undefined,
        service_items: Array.isArray(data.service_items) ? data.service_items as unknown as Array<{ service_id: string; custom_price: number | null }> : undefined,
        services_data: servicesDataMapped.length > 0 ? servicesDataMapped : undefined,
        service: undefined,
        station: data.stations ? { name: (data.stations as any).name, type: (data.stations as any).type } : undefined,
        has_unified_services: data.has_unified_services,
        admin_notes: data.admin_notes,
        checked_service_ids: Array.isArray(data.checked_service_ids) ? data.checked_service_ids as string[] : null,
      };
    };

    const syncTrainings = async () => {
      if (!trainingsEnabled) return;
      try {
        const { data: trainingsData, error } = await supabase
          .from('trainings')
          .select('*, stations:station_id (name, type), training_type_record:training_type_id (id, name, duration_days, sort_order, active, instance_id)')
          .eq('instance_id', instanceId) as any;

        if (error) {
          console.error('Sync trainings error:', error);
          return;
        }

        if (trainingsData) {
          setTrainings(trainingsData.map((t: any) => ({
            ...t,
            assigned_employee_ids: Array.isArray(t.assigned_employee_ids) ? t.assigned_employee_ids : [],
          })));
        }
      } catch (err) {
        console.error('Sync trainings exception:', err);
      }
    };

    // Polling fallback function
    const pollForUpdates = async () => {
      if (isCleanedUp) return;
      
      try {
        // Fetch recent reservations (created/updated since last poll)
        const query = supabase
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
            updated_at,
            stations:station_id (name, type)
          `)
          .eq('instance_id', instanceId)
          .order('updated_at', { ascending: false })
          .limit(50);

        // If we have a timestamp, only fetch newer records
        if (lastPollTimestamp) {
          query.gt('updated_at', lastPollTimestamp);
        }

        const { data } = await query;

        if (data && data.length > 0) {
          // Update last poll timestamp
          lastPollTimestamp = data[0].updated_at;
          
          // Update local state with new/updated reservations
          setReservations(prev => {
            const updatedReservations = [...prev];
            for (const newRes of data) {
              const mappedRes = mapReservationData(newRes);
              const existingIdx = updatedReservations.findIndex(r => r.id === newRes.id);
              if (existingIdx >= 0) {
                updatedReservations[existingIdx] = mappedRes;
              } else {
                updatedReservations.push(mappedRes);
              }
            }
            return updatedReservations;
          });

          // Reset poll interval when changes detected
          pollInterval = 3000;
        } else if (!realtimeWorking) {
          // Increase poll interval gradually when no changes and realtime not working
          pollInterval = Math.min(pollInterval * 1.3, 15000); // Cap at 15s
        }
      } catch (error) {
        console.error('Polling reservations error:', error);
      }

      // Trainings sync is independent from reservations polling so one failure does not hide trainings
      await syncTrainings();

      // Schedule next poll
      if (!isCleanedUp) {
        pollTimeoutId = setTimeout(pollForUpdates, pollInterval);
      }
    };

    // Setup realtime channel with retry logic (same as AdminDashboard)
    const setupRealtimeChannel = () => {
      if (isCleanedUp) return;
      
      // Remove previous channel if exists
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
      }

      currentChannel = supabase
        .channel(`hall-reservations-changes-${Date.now()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `instance_id=eq.${instanceId}`
        }, payload => {
          console.log('[HallView] Realtime reservation update:', payload);
          realtimeWorking = true;
          pollInterval = 3000; // Reset poll interval when realtime works
          retryCount = 0; // Reset retry count on successful message

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
                  const newReservation = mapReservationData(data);
                  setReservations(prev => {
                    // Deduplicate by ID
                    const filtered = prev.filter(r => r.id !== data.id);
                    return [...filtered, newReservation];
                  });
                  
                  const isCustomerReservation = (data as any).source === 'customer';
                  toast.success(isCustomerReservation ? `🔔 ${t('notifications.newReservation')}!` : `${t('notifications.newReservation')}!`, {
                    description: `${data.start_time.slice(0, 5)} - ${data.vehicle_plate}`
                  });
                }
              });
          } else if (payload.eventType === 'UPDATE') {
            // Fetch full data from server to ensure complete object
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
                  const updatedReservation = mapReservationData(data);
                  setReservations(prev => prev.map(r => r.id === data.id ? updatedReservation : r));
                  // Also update selectedReservation if it's the same
                  setSelectedReservation(prev => 
                    prev?.id === data.id ? updatedReservation : prev
                  );
                }
              });
          } else if (payload.eventType === 'DELETE') {
            setReservations(prev => prev.filter(r => r.id !== payload.old.id));
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'trainings',
          filter: `instance_id=eq.${instanceId}`
        }, async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data } = await supabase
              .from('trainings')
              .select('*, stations:station_id (name, type), training_type_record:training_type_id (id, name, duration_days, sort_order, active, instance_id)')
              .eq('id', payload.new.id)
              .single() as any;
            if (data) {
              const mapped: Training = {
                ...data,
                assigned_employee_ids: Array.isArray(data.assigned_employee_ids) ? data.assigned_employee_ids : [],
              };

              // Upsert to prevent disappearing trainings after reconnect or missed INSERT
              setTrainings(prev => {
                const exists = prev.some(t => t.id === mapped.id);
                return exists ? prev.map(t => t.id === mapped.id ? mapped : t) : [...prev, mapped];
              });

              setSelectedTraining(prev => prev?.id === mapped.id ? mapped : prev);
            }
          } else if (payload.eventType === 'DELETE') {
            setTrainings(prev => prev.filter(t => t.id !== payload.old.id));
            setSelectedTraining(prev => prev?.id === payload.old.id ? null : prev);
          }
        })
        .subscribe((status, err) => {
          console.log('[HallView] Channel status:', status, err);
          if (status === 'SUBSCRIBED') {
            realtimeWorking = true;
            retryCount = 0;
            void syncTrainings(); // recover possible gaps after reconnect
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeWorking = false;
            pollInterval = 3000; // Reset to fast polling when realtime fails
            void syncTrainings();
            
            // Auto-retry with exponential backoff
            if (retryCount < maxRetries && !isCleanedUp) {
              retryCount++;
              const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
              console.log(`[HallView] Retrying realtime connection in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
              setTimeout(setupRealtimeChannel, delay);
            }
          } else if (status === 'CLOSED') {
            realtimeWorking = false;
            pollInterval = 3000;
            void syncTrainings();
          }
        });
    };

    // Start realtime subscription
    setupRealtimeChannel();
    
    // Start polling as fallback
    pollTimeoutId = setTimeout(pollForUpdates, pollInterval);

    return () => {
      isCleanedUp = true;
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
      }
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }
    };
  }, [instanceId, t, trainingsEnabled]);

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedTraining(null);
    setTrainingDetailsOpen(false);
    setSelectedReservation(reservation);
  };

  const handleTrainingClick = (training: Training) => {
    setSelectedReservation(null);
    setSelectedTraining(training);
    setTrainingDetailsOpen(true);
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
  // Primary source: service_ids as canonical (like AdminDashboard), with names from service_items or servicesMap
  const reservationsWithServices = useMemo(() => {
    return reservations.map(reservation => {
      const serviceItems = reservation.service_items as any[] | undefined;
      const serviceIds = reservation.service_ids;
      
      let services_data: Array<{ id: string; name: string }> = [];
      
      // service_ids to kanoniczne źródło (jak w AdminDashboard)
      if (serviceIds && serviceIds.length > 0) {
        const itemsById = new Map<string, any>();
        (serviceItems || []).forEach(item => {
          const id = item.id || item.service_id;
          if (id) itemsById.set(id, item);
        });
        
        services_data = serviceIds.map(id => {
          const item = itemsById.get(id);
          const globalName = servicesMap.get(id);
          return {
            id,
            name: item?.name ?? globalName ?? 'Usługa',
          };
        });
      } else if (serviceItems && serviceItems.length > 0) {
        // Fallback z deduplicacją
        const seen = new Set<string>();
        services_data = serviceItems
          .filter(item => {
            const id = item.id || item.service_id;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .map(item => ({
            id: item.id || item.service_id,
            name: item.name || servicesMap.get(item.id || item.service_id) || 'Usługa',
          }));
      }
      
      return { ...reservation, services_data };
    });
  }, [reservations, servicesMap]);

  // Map selected reservation with services_data (including service id for toggle)
  // Primary source: service_ids as canonical
  const selectedReservationWithServices = useMemo(() => {
    if (!selectedReservation) return null;
    
    const serviceItems = selectedReservation.service_items as any[] | undefined;
    const serviceIds = selectedReservation.service_ids;
    let services_data: Array<{ id: string; name: string }> = [];
    
    // service_ids jako kanoniczne źródło
    if (serviceIds && serviceIds.length > 0) {
      const itemsById = new Map<string, any>();
      (serviceItems || []).forEach(item => {
        const id = item.id || item.service_id;
        if (id) itemsById.set(id, item);
      });
      
      services_data = serviceIds.map(id => {
        const item = itemsById.get(id);
        const globalName = servicesMap.get(id);
        return {
          id,
          name: item?.name ?? globalName ?? 'Usługa',
        };
      });
    } else if (serviceItems && serviceItems.length > 0) {
      // Fallback z deduplicacją
      const seen = new Set<string>();
      services_data = serviceItems
        .filter(item => {
          const id = item.id || item.service_id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map(item => ({
          id: item.id || item.service_id,
          name: item.name || servicesMap.get(item.id || item.service_id) || 'Usługa',
        }));
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

  // Render workers list with sidebar
  if (showWorkersList && instanceId) {
    return (
      <>
        <Helmet>
          <title>Pracownicy | {hall?.name || t('hall.title')}</title>
        </Helmet>

        <div className="h-screen w-screen overflow-hidden bg-background flex">
          {/* Mini Sidebar for hall view */}
          <aside className="sticky top-0 inset-y-0 left-0 z-50 h-screen w-16 bg-card border-r border-border/50 flex-shrink-0">
            <div className="flex flex-col h-full overflow-hidden">
              <nav className="flex-1 space-y-2 p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2"
                  onClick={handleCalendarFromSidebar}
                  title={t('navigation.calendar')}
                >
                  <Calendar className="w-4 h-4 shrink-0 text-primary" />
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-center px-2"
                  title="Pracownicy"
                >
                  <Users className="w-4 h-4 shrink-0 text-primary" />
                </Button>

                {canAccessProtocols && (
                  <Button
                    variant="ghost"
                    className="w-full justify-center px-2"
                    onClick={handleProtocolsNavigation}
                    title={t('navigation.protocols')}
                  >
                    <FileText className="w-4 h-4 shrink-0 text-primary" />
                  </Button>
                )}
              </nav>

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

          {/* Workers content - centered */}
          <div className="flex-1 h-full overflow-auto">
            <EmployeesList instanceId={instanceId} centered />
          </div>
        </div>
      </>
    );
  }

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
                  onClick={handleCalendarFromSidebar}
                  title={t('navigation.calendar')}
                >
                  <Calendar className="w-4 h-4 shrink-0 text-primary" />
                </Button>

                {/* Workers icon */}
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2"
                  onClick={handleWorkersNavigation}
                  title="Pracownicy"
                >
                  <Users className="w-4 h-4 shrink-0 text-primary" />
                </Button>

                {/* Protocols icon - active */}
                <Button
                  variant="secondary"
                  className="w-full justify-center px-2"
                  title={t('navigation.protocols')}
                >
                  <FileText className="w-4 h-4 shrink-0 text-primary" />
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
                variant={!showProtocolsList && !showWorkersList ? 'secondary' : 'ghost'}
                className="w-full justify-center px-2"
                onClick={handleCalendarFromSidebar}
                title={t('navigation.calendar')}
              >
                <Calendar className="w-4 h-4 shrink-0 text-primary" />
              </Button>

              {/* Workers icon */}
              <Button
                variant={showWorkersList ? 'secondary' : 'ghost'}
                className="w-full justify-center px-2"
                onClick={handleWorkersNavigation}
                title="Pracownicy"
              >
                <Users className="w-4 h-4 shrink-0 text-primary" />
              </Button>

              {/* Protocols icon */}
              {canAccessProtocols && (
                <Button
                  variant={showProtocolsList ? 'secondary' : 'ghost'}
                  className="w-full justify-center px-2"
                  onClick={handleProtocolsNavigation}
                  title={t('navigation.protocols')}
                >
                  <FileText className="w-4 h-4 shrink-0 text-primary" />
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
            trainings={trainings}
            onTrainingClick={handleTrainingClick}
            trainingsEnabled={trainingsEnabled}
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
            const now = new Date();
            const { error } = await supabase.from('reservations').update({ status: 'completed', completed_at: now.toISOString() }).eq('id', id);
            if (!error) {
              setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'completed' } : r));
              setSelectedReservation(prev => prev?.id === id ? { ...prev, status: 'completed' } : prev);
            } else {
              toast.error(t('common.error'));
            }
          }}
          onSendPickupSms={handleSendPickupSms}
          onAddProtocol={canAccessProtocols ? handleAddProtocol : undefined}
          onAddPhotos={handleAddPhotos}
          onServiceToggle={handleServiceToggle}
          onAddService={(res) => setServiceDrawerReservation(res as Reservation)}
          onRemoveService={handleRemoveServiceFromReservation}
        />
      )}

      {/* Service Selection Drawer for hall view */}
      {serviceDrawerReservation && instanceId && (
        <ServiceSelectionDrawer
          open={!!serviceDrawerReservation}
          onClose={() => setServiceDrawerReservation(null)}
          instanceId={instanceId}
          carSize="medium"
          selectedServiceIds={serviceDrawerReservation.service_ids || []}
          hasUnifiedServices={serviceDrawerReservation.has_unified_services ?? true}
          hideSelectedSection={true}
          onConfirm={(serviceIds, _duration, servicesData) => {
            const currentIds = serviceDrawerReservation.service_ids || [];
            const newIds = serviceIds.filter(id => !currentIds.includes(id));
            if (newIds.length > 0) {
              handleAddServicesToReservation(newIds, servicesData);
            }
            setServiceDrawerReservation(null);
          }}
        />
      )}

      {/* Training Details Drawer (read-only for hall) */}
      {selectedTraining && instanceId && (
        <TrainingDetailsDrawer
          open={trainingDetailsOpen}
          onClose={() => {
            setTrainingDetailsOpen(false);
            setSelectedTraining(null);
          }}
          training={selectedTraining}
          instanceId={instanceId}
          onEdit={() => {}}
          onDeleted={() => {
            setTrainings(prev => prev.filter(t => t.id !== selectedTraining.id));
            setSelectedTraining(null);
            setTrainingDetailsOpen(false);
          }}
          readOnly={true}
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
