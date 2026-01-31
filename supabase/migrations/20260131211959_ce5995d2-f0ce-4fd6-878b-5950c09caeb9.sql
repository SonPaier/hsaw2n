-- Allow hall role to insert days off for employees
CREATE POLICY "Hall can create days off"
ON public.employee_days_off
FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));