import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export interface TimeEntry {
  id: string;
  instance_id: string;
  employee_id: string;
  entry_date: string;
  entry_number: number;
  entry_type: string;
  start_time: string | null;
  end_time: string | null;
  total_minutes: number | null;
  is_auto_closed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TimeEntryInput {
  employee_id: string;
  entry_date: string;
  start_time?: string | null;
  end_time?: string | null;
  entry_type?: string;
}

export interface TimeEntrySummary {
  employee_id: string;
  total_minutes: number;
  entries_count: number;
}

export const useTimeEntries = (instanceId: string | null, employeeId?: string | null, dateFrom?: string, dateTo?: string) => {
  return useQuery({
    queryKey: ['time_entries', instanceId, employeeId, dateFrom, dateTo],
    queryFn: async (): Promise<TimeEntry[]> => {
      if (!instanceId) return [];
      
      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('instance_id', instanceId);
      
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      
      if (dateFrom) {
        query = query.gte('entry_date', dateFrom);
      }
      
      if (dateTo) {
        query = query.lte('entry_date', dateTo);
      }
      
      query = query.order('entry_date', { ascending: false })
                   .order('entry_number', { ascending: true });
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useTimeEntriesForMonth = (instanceId: string | null, year: number, month: number) => {
  const dateFrom = format(startOfMonth(new Date(year, month)), 'yyyy-MM-dd');
  const dateTo = format(endOfMonth(new Date(year, month)), 'yyyy-MM-dd');
  
  return useTimeEntries(instanceId, null, dateFrom, dateTo);
};

export const useTimeEntriesForDateRange = (instanceId: string | null, dateFrom: string, dateTo: string) => {
  return useTimeEntries(instanceId, null, dateFrom, dateTo);
};

export const useCreateTimeEntry = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: TimeEntryInput) => {
      if (!instanceId) throw new Error('No instance ID');
      
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          instance_id: instanceId,
          ...input,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', instanceId] });
    },
  });
};

export const useUpdateTimeEntry = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<TimeEntryInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', instanceId] });
    },
  });
};

export const useDeleteTimeEntry = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', instanceId] });
    },
  });
};

// Calculate monthly summary per employee
export const calculateMonthlySummary = (entries: TimeEntry[]): Map<string, TimeEntrySummary> => {
  const summaryMap = new Map<string, TimeEntrySummary>();
  
  entries.forEach(entry => {
    const existing = summaryMap.get(entry.employee_id) || {
      employee_id: entry.employee_id,
      total_minutes: 0,
      entries_count: 0,
    };
    
    existing.total_minutes += entry.total_minutes || 0;
    existing.entries_count += 1;
    
    summaryMap.set(entry.employee_id, existing);
  });
  
  return summaryMap;
};

// Format minutes to hours and minutes string
export const formatMinutesToTime = (minutes: number | null): string => {
  if (!minutes) return '0h 0min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
};
