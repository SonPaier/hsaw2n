-- Allow hall users to create employees within their instance
CREATE POLICY "Hall can create employees"
ON public.employees
FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- Allow hall users to update employees within their instance (for photo, name)
CREATE POLICY "Hall can update employees"
ON public.employees
FOR UPDATE
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));