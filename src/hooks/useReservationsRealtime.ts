import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseISO } from 'date-fns';
import type { Reservation } from './useReservations';

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

interface UseReservationsRealtimeOptions {
  instanceId: string | null;
  servicesMapRef: React.MutableRefObject<Map<string, ServiceMap>>;
  loadedDateRangeFrom: Date;
  onInsert: (reservation: Reservation) => void;
  onUpdate: (reservation: Reservation) => void;
  onDelete: (reservationId: string) => void;
  onRefetch: () => void;
  onNewCustomerReservation?: (reservation: Reservation) => void;
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  // Minimum time between full refetches (prevents burst refetches)
  minRefetchInterval: 10000, // 10 seconds
  // Exponential backoff multiplier
  backoffMultiplier: 1.5
};

export function useReservationsRealtime({
  instanceId,
  servicesMapRef,
  loadedDateRangeFrom,
  onInsert,
  onUpdate,
  onDelete,
  onRefetch,
  onNewCustomerReservation
}: UseReservationsRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(true);
  
  // Rate limiting refs
  const lastRefetchTimeRef = useRef<number>(0);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Debounce mechanism to prevent realtime updates from overwriting local changes
  const recentlyUpdatedRef = useRef<Map<string, number>>(new Map());
  
  // Track loaded date range with ref to avoid re-subscriptions
  const loadedDateRangeFromRef = useRef(loadedDateRangeFrom);
  loadedDateRangeFromRef.current = loadedDateRangeFrom;

  const markAsLocallyUpdated = useCallback((reservationId: string, durationMs = 3000) => {
    recentlyUpdatedRef.current.set(reservationId, Date.now());
    setTimeout(() => {
      recentlyUpdatedRef.current.delete(reservationId);
    }, durationMs);
  }, []);

  // Rate-limited refetch
  const rateLimitedRefetch = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefetch = now - lastRefetchTimeRef.current;
    
    if (timeSinceLastRefetch < RATE_LIMIT_CONFIG.minRefetchInterval) {
      console.log(`[Realtime] Skipping refetch - rate limited (${timeSinceLastRefetch}ms since last)`);
      return;
    }
    
    lastRefetchTimeRef.current = now;
    onRefetch();
  }, [onRefetch]);

  // Map raw data to Reservation
  const mapRealtimeData = useCallback((data: any): Reservation => {
    const serviceItems = data.service_items as ServiceItem[] | null;
    const serviceIds = data.service_ids as string[] | null;

    let servicesDataMapped: Array<{
      id?: string;
      name: string;
      shortcut?: string | null;
      price_small?: number | null;
      price_medium?: number | null;
      price_large?: number | null;
      price_from?: number | null;
    }> = [];

    if (serviceItems && serviceItems.length > 0) {
      servicesDataMapped = serviceItems.map(item => ({
        id: item.id || item.service_id,
        name: item.name || 'Usługa',
        shortcut: item.short_name || null,
        price_small: item.price_small ?? null,
        price_medium: item.price_medium ?? null,
        price_large: item.price_large ?? null,
        price_from: item.price_from ?? null
      }));
    } else if (serviceIds && serviceIds.length > 0) {
      serviceIds.forEach(id => {
        const svc = servicesMapRef.current.get(id);
        if (svc) {
          servicesDataMapped.push(svc);
        }
      });
    }

    return {
      ...data,
      status: data.status || 'pending',
      service_ids: Array.isArray(data.service_ids) ? data.service_ids : undefined,
      service_items: Array.isArray(data.service_items) ? data.service_items : undefined,
      services_data: servicesDataMapped.length > 0 ? servicesDataMapped : undefined,
      station: data.stations ? {
        name: data.stations.name,
        type: data.stations.type
      } : undefined,
      has_unified_services: data.has_unified_services,
      photo_urls: data.photo_urls,
      checked_service_ids: Array.isArray(data.checked_service_ids) ? data.checked_service_ids : undefined
    } as Reservation;
  }, [servicesMapRef]);

  useEffect(() => {
    if (!instanceId) return;

    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let isCleanedUp = false;

    // Notification sound
    const playNotificationSound = () => {
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    };

    const setupRealtimeChannel = () => {
      if (isCleanedUp) return;
      
      // Remove previous channel if exists
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }

      currentChannel = supabase
        .channel(`reservations-${instanceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
            filter: `instance_id=eq.${instanceId}`
          },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as any;
              const reservationDate = parseISO(newRecord.reservation_date);

              // Check if within loaded range
              if (reservationDate < loadedDateRangeFromRef.current) {
                return;
              }

              // Play sound for customer reservations
              if (newRecord.source === 'customer') {
                playNotificationSound();
              }

              // Fetch full reservation data
              const { data } = await supabase.from('reservations').select(`
                id, instance_id, customer_name, customer_phone, vehicle_plate,
                reservation_date, end_date, start_time, end_time, station_id,
                status, confirmation_code, price, source, service_ids, service_items,
                created_by_username, offer_number, photo_urls, has_unified_services,
                checked_service_ids, stations:station_id (name, type)
              `).eq('id', payload.new.id).single();

              if (data) {
                const reservation = mapRealtimeData(data);
                onInsert(reservation);

                if (data.source === 'customer') {
                  onNewCustomerReservation?.(reservation);
                }
              }
            } else if (payload.eventType === 'UPDATE') {
              // Skip if recently updated locally
              const lastLocalUpdate = recentlyUpdatedRef.current.get(payload.new.id);
              if (lastLocalUpdate && Date.now() - lastLocalUpdate < 3000) {
                console.log('[Realtime] Skipping update for locally modified reservation:', payload.new.id);
                return;
              }

              // Fetch full reservation data
              const { data } = await supabase.from('reservations').select(`
                id, instance_id, customer_name, customer_phone, vehicle_plate,
                reservation_date, end_date, start_time, end_time, station_id,
                status, confirmation_code, price, source, service_ids, service_items,
                admin_notes, customer_notes, car_size, offer_number, photo_urls,
                has_unified_services, checked_service_ids, stations:station_id (name, type)
              `).eq('id', payload.new.id).single();

              if (data) {
                const reservation = mapRealtimeData(data);
                onUpdate(reservation);
              }
            } else if (payload.eventType === 'DELETE') {
              onDelete(payload.old.id);
            }
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);

          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            retryCountRef.current = 0;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false);

            if (isCleanedUp) return;

            // Rate-limited retry with exponential backoff
            if (retryCountRef.current < RATE_LIMIT_CONFIG.maxRetries) {
              retryCountRef.current++;
              const delay = Math.min(
                RATE_LIMIT_CONFIG.baseDelay * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, retryCountRef.current),
                RATE_LIMIT_CONFIG.maxDelay
              );
              console.log(`[Realtime] Retry ${retryCountRef.current}/${RATE_LIMIT_CONFIG.maxRetries} in ${delay}ms`);

              retryTimeoutRef.current = setTimeout(() => {
                if (isCleanedUp) return;
                // Rate-limited refetch in case events were missed
                rateLimitedRefetch();
                setupRealtimeChannel();
              }, delay);
            } else {
              console.error('[Realtime] Max retries reached, falling back to periodic fetch');
              // Fallback: periodic fetch every 30s
              retryTimeoutRef.current = setTimeout(() => {
                if (isCleanedUp) return;
                rateLimitedRefetch();
                retryCountRef.current = 0;
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
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [instanceId, mapRealtimeData, onInsert, onUpdate, onDelete, rateLimitedRefetch, onNewCustomerReservation]);

  return {
    isConnected,
    markAsLocallyUpdated
  };
}
