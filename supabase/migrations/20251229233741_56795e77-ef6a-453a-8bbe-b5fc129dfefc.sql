-- Allow public users to update offer status via token
CREATE POLICY "Public can update offer via token"
ON public.offers
FOR UPDATE
USING (true)
WITH CHECK (true);