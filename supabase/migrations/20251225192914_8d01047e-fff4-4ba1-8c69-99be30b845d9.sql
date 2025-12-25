-- Allow admins to update their own instance
CREATE POLICY "Admins can update own instance" 
ON public.instances 
FOR UPDATE 
USING (has_instance_role(auth.uid(), 'admin'::app_role, id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, id));