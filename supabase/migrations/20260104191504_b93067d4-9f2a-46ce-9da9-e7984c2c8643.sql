-- Allow public users to view reservations by confirmation_code
-- This is needed for the /res?code=... public page to work

CREATE POLICY "Public can view reservation by confirmation code"
ON public.reservations
FOR SELECT
USING (true);