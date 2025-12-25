-- Allow admins to read their own instance (needed for settings)
CREATE POLICY "Admins can read own instance" 
ON public.instances 
FOR SELECT 
USING (has_instance_role(auth.uid(), 'admin'::app_role, id));