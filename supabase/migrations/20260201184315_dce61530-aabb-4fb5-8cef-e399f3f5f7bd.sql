-- Allow hall users to remove days off within their instance
CREATE POLICY "Hall can delete days off"
ON public.employee_days_off
FOR DELETE
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));