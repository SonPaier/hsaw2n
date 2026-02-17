import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DictionaryService {
  id: string;
  name: string;
  short_name: string | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  price_from: number | null;
}

/**
 * Central service dictionary – single source of truth for service name resolution.
 * Loads ALL services for the instance (no service_type filter) so that
 * historical reservation IDs (offer-only, reservation-only, both) always resolve.
 *
 * staleTime: 1 h  –  invalidate via queryClient.invalidateQueries(['service_dictionary', instanceId])
 */
export function useServiceDictionary(instanceId: string | null) {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['service_dictionary', instanceId],
    queryFn: async (): Promise<DictionaryService[]> => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('unified_services')
        .select('id, name, short_name, price_small, price_medium, price_large, price_from')
        .eq('instance_id', instanceId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 60 * 60 * 1000,     // 1 h
    gcTime: 2 * 60 * 60 * 1000,    // 2 h
  });

  /** Map<id, DictionaryService> for O(1) lookups */
  const map = useMemo(() => {
    const m = new Map<string, DictionaryService>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  /** Get display name (short_name preferred, fallback to name, then id) */
  const getServiceLabel = (id: string): string => {
    const s = map.get(id);
    return s?.short_name || s?.name || id;
  };

  /** Get full name */
  const getServiceName = (id: string): string => {
    return map.get(id)?.name || id;
  };

  /** Get short name */
  const getServiceShortName = (id: string): string | null => {
    return map.get(id)?.short_name ?? null;
  };

  return {
    services,
    map,
    isLoading,
    getServiceLabel,
    getServiceName,
    getServiceShortName,
  };
}

// ----- Helpers used across mapping functions -----

export interface ServiceMapEntry {
  id: string;
  name: string;
  shortcut?: string | null;
  price_small?: number | null;
  price_medium?: number | null;
  price_large?: number | null;
  price_from?: number | null;
}

/** Build a ServiceMapEntry-compatible map from the dictionary */
export function buildServicesMapFromDictionary(
  dictMap: Map<string, DictionaryService>
): Map<string, ServiceMapEntry> {
  const result = new Map<string, ServiceMapEntry>();
  for (const [id, s] of dictMap) {
    result.set(id, {
      id: s.id,
      name: s.name,
      shortcut: s.short_name,
      price_small: s.price_small,
      price_medium: s.price_medium,
      price_large: s.price_large,
      price_from: s.price_from,
    });
  }
  return result;
}
