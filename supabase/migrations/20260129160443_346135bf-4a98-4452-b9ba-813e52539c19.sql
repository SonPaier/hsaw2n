-- Update RLS policy to allow 'hall' role to view halls
DROP POLICY IF EXISTS "Employees can view halls" ON public.halls;

CREATE POLICY "Employees and hall users can view halls"
ON public.halls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND (
      user_roles.role = 'super_admin'
      OR (
        user_roles.role IN ('admin', 'employee', 'hall')
        AND user_roles.instance_id = halls.instance_id
      )
    )
  )
);