import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfWeek, subWeeks, addDays, parseISO } from 'date-fns';

interface ServiceItem {
  service_id: string;
  custom_price: number | null;
  name?: string;
  id?: string;
  short_name?: string | null;
  price_small?: number | null;
  price_medium?: number | null;
  price_large?: number | null;
  price_from?: number | null;
}

interface ServiceMap {
  id: string;
  name: string;
  shortcut?: string | null;
  price_small?: number | null;
  price_medium?: number | null;
  price_large?: number | null;
  price_from?: number | null;
}

export interface Reservation {
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
    id?: string;
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
  service_items?: ServiceItem[] | null;
  service_ids?: string[];
  has_unified_services?: boolean | null;
  photo_urls?: string[] | null;
  checked_service_ids?: string[];
}

interface DateRange {
  from: Date;
  to: Date | null;
}

// Fetch reservations for a specific date range
async function fetchReservationsForRange(
  instanceId: string,
  from: Date,
  to: Date | null,
  servicesMap: Map<string, ServiceMap>
): Promise<Reservation[]> {
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
    service_items,
    original_reservation_id,
    created_by,
    created_by_username,
    offer_number,
    confirmation_sms_sent_at,
    pickup_sms_sent_at,
    has_unified_services,
    photo_urls,
    checked_service_ids,
    stations:station_id (name, type)
  `).eq('instance_id', instanceId)
    .neq('status', 'cancelled')
    .gte('reservation_date', format(from, 'yyyy-MM-dd'));

  if (to !== null) {
    query = query.lte('reservation_date', format(to, 'yyyy-MM-dd'));
  }

  const { data, error } = await query;

  if (error || !data) {
    throw error || new Error('Failed to fetch reservations');
  }

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

  // Map reservation data
  return data.map((r: any) => {
    const serviceItems = r.service_items as ServiceItem[] | null;
    const serviceIds = r.service_ids as string[] | null;

    let servicesDataMapped: Array<{
      id?: string;
      name: string;
      shortcut?: string | null;
      price_small?: number | null;
      price_medium?: number | null;
      price_large?: number | null;
      price_from?: number | null;
    }> = [];

    // Priority: service_ids + service_items for metadata
    if (serviceIds && serviceIds.length > 0) {
      const itemsById = new Map<string, ServiceItem>();
      if (serviceItems) {
        serviceItems.forEach(item => {
          const key = item.id || item.service_id;
          if (key) itemsById.set(key, item);
        });
      }

      servicesDataMapped = serviceIds.map(id => {
        const item = itemsById.get(id);
        const svc = servicesMap.get(id);

        return {
          id,
          name: item?.name ?? svc?.name ?? 'Usługa',
          shortcut: item?.short_name ?? svc?.shortcut ?? null,
          price_small: item?.price_small ?? svc?.price_small ?? null,
          price_medium: item?.price_medium ?? svc?.price_medium ?? null,
          price_large: item?.price_large ?? svc?.price_large ?? null,
          price_from: item?.price_from ?? svc?.price_from ?? null
        };
      });
    } else if (serviceItems && serviceItems.length > 0) {
      const seen = new Set<string>();
      servicesDataMapped = serviceItems
        .map(item => {
          const resolvedId = item.id || item.service_id;
          const svc = resolvedId ? servicesMap.get(resolvedId) : undefined;
          return {
            id: resolvedId,
            name: item.name ?? svc?.name ?? 'Usługa',
            shortcut: item.short_name ?? svc?.shortcut ?? null,
            price_small: item.price_small ?? svc?.price_small ?? null,
            price_medium: item.price_medium ?? svc?.price_medium ?? null,
            price_large: item.price_large ?? svc?.price_large ?? null,
            price_from: item.price_from ?? svc?.price_from ?? null
          };
        })
        .filter(svc => {
          if (!svc.id) return false;
          if (seen.has(svc.id)) return false;
          seen.add(svc.id);
          return true;
        });
    }

    const originalReservation = r.original_reservation_id
      ? originalReservationsMap.get(r.original_reservation_id)
      : null;

    return {
      ...r,
      status: r.status || 'pending',
      service_ids: Array.isArray(r.service_ids) ? r.service_ids as string[] : undefined,
      service_items: Array.isArray(r.service_items) ? r.service_items as ServiceItem[] : undefined,
      services_data: servicesDataMapped.length > 0 ? servicesDataMapped : undefined,
      station: r.stations ? {
        name: r.stations.name,
        type: r.stations.type
      } : undefined,
      original_reservation: originalReservation || null,
      created_by_username: r.created_by_username || null,
      has_unified_services: r.has_unified_services ?? null,
      checked_service_ids: Array.isArray(r.checked_service_ids) ? r.checked_service_ids : undefined
    } as Reservation;
  });
}

interface UseReservationsOptions {
  instanceId: string | null;
  services: Array<{
    id: string;
    name: string;
    short_name?: string | null;
    price_small?: number | null;
    price_medium?: number | null;
    price_large?: number | null;
    price_from?: number | null;
  }>;
}

export function useReservations({ instanceId, services }: UseReservationsOptions) {
  const queryClient = useQueryClient();
  
  // Calculate initial date range: 1 week back from Monday
  const initialDateRange = useMemo(() => {
    const today = new Date();
    const mondayThisWeek = startOfWeek(today, { weekStartsOn: 1 });
    return {
      from: subWeeks(mondayThisWeek, 1),
      to: null // All future reservations
    };
  }, []);

  // Track loaded date range for incremental loading
  const loadedRangeRef = useRef<DateRange>(initialDateRange);
  
  // Debounce ref for loadMore
  const loadMoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingMoreRef = useRef(false);

  // Build services map
  const servicesMap = useMemo(() => {
    const map = new Map<string, ServiceMap>();
    services.forEach(s => map.set(s.id, {
      id: s.id,
      name: s.name,
      shortcut: s.short_name,
      price_small: s.price_small,
      price_medium: s.price_medium,
      price_large: s.price_large,
      price_from: s.price_from
    }));
    return map;
  }, [services]);

  // Ref for realtime handler
  const servicesMapRef = useRef(servicesMap);
  servicesMapRef.current = servicesMap;

  // Main query - fetches reservations for the loaded range
  const {
    data: reservations = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['reservations', instanceId, format(loadedRangeRef.current.from, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!instanceId) return [];
      return fetchReservationsForRange(
        instanceId,
        loadedRangeRef.current.from,
        loadedRangeRef.current.to,
        servicesMapRef.current
      );
    },
    enabled: !!instanceId && services.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  // Load more past reservations
  const loadMoreReservations = useCallback(async () => {
    if (!instanceId || isLoadingMoreRef.current) return;
    
    isLoadingMoreRef.current = true;
    
    try {
      const currentFrom = loadedRangeRef.current.from;
      const newFrom = subMonths(currentFrom, 1);
      
      // Fetch additional reservations
      const additionalReservations = await fetchReservationsForRange(
        instanceId,
        newFrom,
        currentFrom, // Up to old 'from' date (exclusive in query via lt)
        servicesMapRef.current
      );
      
      // Update loaded range
      loadedRangeRef.current = {
        ...loadedRangeRef.current,
        from: newFrom
      };
      
      // Merge with existing data (prepend older reservations)
      queryClient.setQueryData<Reservation[]>(
        ['reservations', instanceId, format(currentFrom, 'yyyy-MM-dd')],
        (old = []) => {
          // Filter out any duplicates
          const existingIds = new Set(old.map(r => r.id));
          const uniqueNew = additionalReservations.filter(r => !existingIds.has(r.id));
          return [...uniqueNew, ...old];
        }
      );
      
      // Update query key to reflect new range
      queryClient.setQueryData(
        ['reservations', instanceId, format(newFrom, 'yyyy-MM-dd')],
        queryClient.getQueryData(['reservations', instanceId, format(currentFrom, 'yyyy-MM-dd')])
      );
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [instanceId, queryClient]);

  // Debounced version for calendar navigation
  const loadMoreReservationsDebounced = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
    }
    loadMoreDebounceRef.current = setTimeout(() => {
      loadMoreReservations();
    }, 300);
  }, [loadMoreReservations]);

  // Check if date is approaching edge of loaded data
  const checkAndLoadMore = useCallback((date: Date) => {
    const bufferDays = 7;
    if (date < addDays(loadedRangeRef.current.from, bufferDays)) {
      loadMoreReservationsDebounced();
    }
  }, [loadMoreReservationsDebounced]);

  // Update a single reservation in cache (for realtime updates)
  const updateReservationInCache = useCallback((updatedReservation: Reservation) => {
    queryClient.setQueryData<Reservation[]>(
      ['reservations', instanceId, format(loadedRangeRef.current.from, 'yyyy-MM-dd')],
      (old = []) => {
        const exists = old.some(r => r.id === updatedReservation.id);
        if (exists) {
          return old.map(r => r.id === updatedReservation.id ? updatedReservation : r);
        }
        return [...old, updatedReservation];
      }
    );
  }, [instanceId, queryClient]);

  // Remove a reservation from cache
  const removeReservationFromCache = useCallback((reservationId: string) => {
    queryClient.setQueryData<Reservation[]>(
      ['reservations', instanceId, format(loadedRangeRef.current.from, 'yyyy-MM-dd')],
      (old = []) => old.filter(r => r.id !== reservationId)
    );
  }, [instanceId, queryClient]);

  // Invalidate and refetch
  const invalidateReservations = useCallback(() => {
    queryClient.invalidateQueries({ 
      queryKey: ['reservations', instanceId],
      exact: false 
    });
  }, [instanceId, queryClient]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (loadMoreDebounceRef.current) {
        clearTimeout(loadMoreDebounceRef.current);
      }
    };
  }, []);

  return {
    reservations,
    isLoading,
    isLoadingMore: isLoadingMoreRef.current,
    error,
    refetch,
    loadMoreReservations: loadMoreReservationsDebounced,
    checkAndLoadMore,
    updateReservationInCache,
    removeReservationFromCache,
    invalidateReservations,
    servicesMapRef,
    loadedDateRange: loadedRangeRef.current
  };
}
