import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Employee {
  id: string;
  instance_id: string;
  name: string;
  photo_url: string | null;
  hourly_rate: number | null;
  active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeInput {
  name: string;
  photo_url?: string | null;
  hourly_rate?: number | null;
  active?: boolean;
  sort_order?: number | null;
}

export const useEmployees = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['employees', instanceId],
    queryFn: async (): Promise<Employee[]> => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateEmployee = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: EmployeeInput) => {
      if (!instanceId) throw new Error('No instance ID');
      
      const { data, error } = await supabase
        .from('employees')
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
      queryClient.invalidateQueries({ queryKey: ['employees', instanceId] });
    },
  });
};

export const useUpdateEmployee = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: EmployeeInput & { id: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', instanceId] });
    },
  });
};

export const useDeleteEmployee = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', instanceId] });
    },
  });
};
