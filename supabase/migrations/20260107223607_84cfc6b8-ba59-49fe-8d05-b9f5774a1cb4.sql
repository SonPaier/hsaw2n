-- Remove draft restriction from public offer access policies

-- Drop existing public access policies
DROP POLICY IF EXISTS "Public can view offers with valid token" ON public.offers;
DROP POLICY IF EXISTS "Public view offers with token" ON public.offers;
DROP POLICY IF EXISTS "Public update offer via token" ON public.offers;

-- New SELECT policy - access to all offers with token (no draft restriction)
CREATE POLICY "Public view offers with token" 
ON public.offers FOR SELECT 
USING (
  (public_token IS NOT NULL) 
  OR can_access_instance(instance_id)
);

-- New UPDATE policy - full access to update offers with token (no draft restriction)
CREATE POLICY "Public update offer via token"
ON public.offers FOR UPDATE
USING (public_token IS NOT NULL)
WITH CHECK (public_token IS NOT NULL);