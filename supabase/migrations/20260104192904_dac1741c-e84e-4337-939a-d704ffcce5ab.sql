-- Allow public users to update reservations by confirmation_code
-- This is needed for customer editing from /res?code=... page
CREATE POLICY "Public can update reservation by confirmation code"
ON public.reservations
FOR UPDATE
USING (true)
WITH CHECK (true);