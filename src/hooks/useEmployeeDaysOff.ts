import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DayOffType = 'vacation' | 'sick' | 'personal' | 'other';

export interface EmployeeDayOff {
  id: string;
  instance_id: string;
  employee_id: string;
  date_from: string;
  date_to: string;
  day_off_type: DayOffType;
  created_at: string;
}

export interface EmployeeDayOffInput {
  employee_id: string;
  date_from: string;
  date_to: string;
  day_off_type: DayOffType;
}

export const DAY_OFF_TYPE_LABELS: Record<DayOffType, string> = {
  vacation: 'Urlop wypoczynkowy',
  sick: 'Zwolnienie chorobowe',
  personal: 'Urlop na żądanie',
  other: 'Inne',
};

export const useEmployeeDaysOff = (instanceId: string | null, employeeId?: string | null) => {
  return useQuery({
    queryKey: ['employee_days_off', instanceId, employeeId],
    queryFn: async (): Promise<EmployeeDayOff[]> => {
      if (!instanceId) return [];
      
      let query = supabase
        .from('employee_days_off')
        .select('*')
        .eq('instance_id', instanceId);
      
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      
      query = query.order('date_from', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as EmployeeDayOff[];
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateEmployeeDayOff = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: EmployeeDayOffInput) => {
      if (!instanceId) throw new Error('No instance ID');
      
      const { data, error } = await supabase
        .from('employee_days_off')
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
      queryClient.invalidateQueries({ queryKey: ['employee_days_off', instanceId] });
    },
  });
};

export const useDeleteEmployeeDayOff = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (dayOffId: string) => {
      const { error } = await supabase
        .from('employee_days_off')
        .delete()
        .eq('id', dayOffId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_days_off', instanceId] });
    },
  });
};

// Calculate vacation days used in a year
export const calculateVacationDaysUsed = (daysOff: EmployeeDayOff[], year: number): number => {
  return daysOff
    .filter(d => {
      const from = new Date(d.date_from);
      return from.getFullYear() === year && d.day_off_type === 'vacation';
    })
    .reduce((total, d) => {
      const from = new Date(d.date_from);
      const to = new Date(d.date_to);
      const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return total + days;
    }, 0);
};
