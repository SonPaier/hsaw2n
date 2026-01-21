-- Update RLS policies for offer_scopes to handle global scopes

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage offer scopes" ON offer_scopes;
DROP POLICY IF EXISTS "Anyone can view active scopes" ON offer_scopes;

-- Super admins can manage global scopes (instance_id IS NULL)
CREATE POLICY "Super admins can manage global scopes"
ON offer_scopes
FOR ALL
USING (
  source = 'global' 
  AND instance_id IS NULL 
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

-- Instance admins can manage their instance scopes
CREATE POLICY "Instance admins can manage their scopes"
ON offer_scopes
FOR ALL
USING (
  instance_id IS NOT NULL 
  AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
);

-- Anyone can view active scopes (both global and instance)
CREATE POLICY "Anyone can view active scopes"
ON offer_scopes
FOR SELECT
USING (active = true);