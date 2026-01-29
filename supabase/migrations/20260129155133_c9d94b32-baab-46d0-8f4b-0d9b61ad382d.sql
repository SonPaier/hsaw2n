-- Update can_access_instance to include 'hall' role
CREATE OR REPLACE FUNCTION public.can_access_instance(_instance_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    public.is_super_admin() 
    OR public.has_instance_role(auth.uid(), 'admin'::app_role, _instance_id)
    OR public.has_instance_role(auth.uid(), 'employee'::app_role, _instance_id)
    OR public.has_instance_role(auth.uid(), 'hall'::app_role, _instance_id)
$$;