import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StationEmployee {
  id: string;
  station_id: string;
  employee_id: string;
  created_at: string;
}

export const useStationEmployees = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['stationEmployees', instanceId],
    queryFn: async (): Promise<Map<string, string[]>> => {
      if (!instanceId) return new Map();
      
      // First get stations for this instance
      const { data: stations, error: stationsError } = await supabase
        .from('stations')
        .select('id')
        .eq('instance_id', instanceId);
      
      if (stationsError) throw stationsError;
      if (!stations || stations.length === 0) return new Map();
      
      const stationIds = stations.map(s => s.id);
      
      // Then get station_employees for those stations
      const { data, error } = await supabase
        .from('station_employees')
        .select('station_id, employee_id')
        .in('station_id', stationIds);
      
      if (error) throw error;
      
      // Group: station_id -> employee_id[]
      const map = new Map<string, string[]>();
      for (const row of data || []) {
        const ids = map.get(row.station_id) || [];
        ids.push(row.employee_id);
        map.set(row.station_id, ids);
      }
      return map;
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateStationEmployees = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ stationId, employeeIds }: { stationId: string; employeeIds: string[] }) => {
      // Delete existing assignments for this station
      const { error: deleteError } = await supabase
        .from('station_employees')
        .delete()
        .eq('station_id', stationId);
      
      if (deleteError) throw deleteError;
      
      // Insert new assignments
      if (employeeIds.length > 0) {
        const inserts = employeeIds.map(employeeId => ({
          station_id: stationId,
          employee_id: employeeId,
        }));
        
        const { error: insertError } = await supabase
          .from('station_employees')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stationEmployees', instanceId] });
    },
  });
};
