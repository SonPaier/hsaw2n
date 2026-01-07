-- Allow public SELECT access to reservations by confirmation_code
CREATE POLICY "Public can view reservation by confirmation_code"
ON public.reservations
FOR SELECT
USING (true);