-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Public can update own reservation by confirmation_code" ON public.reservations;

-- Create a more restrictive UPDATE policy - customer can only update status to cancelled
CREATE POLICY "Public can cancel own reservation by confirmation_code"
ON public.reservations
FOR UPDATE
USING (true)
WITH CHECK (
  status = 'cancelled'
);