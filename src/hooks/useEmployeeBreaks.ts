import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmployeeBreak {
  id: string;
  instance_id: string;
  employee_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  created_at: string;
}

export interface EmployeeBreakInput {
  employee_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
}

export const useEmployeeBreaks = (instanceId: string | null, employeeId?: string | null, dateFrom?: string, dateTo?: string) => {
  return useQuery({
    queryKey: ['employee_breaks', instanceId, employeeId, dateFrom, dateTo],
    queryFn: async (): Promise<EmployeeBreak[]> => {
      if (!instanceId) return [];
      
      let query = supabase
        .from('employee_breaks')
        .select('*')
        .eq('instance_id', instanceId);
      
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      
      if (dateFrom) {
        query = query.gte('break_date', dateFrom);
      }
      
      if (dateTo) {
        query = query.lte('break_date', dateTo);
      }
      
      query = query.order('break_date', { ascending: false })
                   .order('start_time', { ascending: true });
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateEmployeeBreak = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: EmployeeBreakInput) => {
      if (!instanceId) throw new Error('No instance ID');
      
      // Calculate duration
      const [startH, startM] = input.start_time.split(':').map(Number);
      const [endH, endM] = input.end_time.split(':').map(Number);
      const duration_minutes = (endH * 60 + endM) - (startH * 60 + startM);
      
      const { data, error } = await supabase
        .from('employee_breaks')
        .insert({
          instance_id: instanceId,
          ...input,
          duration_minutes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_breaks', instanceId] });
    },
  });
};

export const useDeleteEmployeeBreak = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (breakId: string) => {
      const { error } = await supabase
        .from('employee_breaks')
        .delete()
        .eq('id', breakId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_breaks', instanceId] });
    },
  });
};
