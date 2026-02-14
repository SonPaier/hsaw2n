CREATE POLICY "Public can read service descriptions"
  ON public.unified_services
  FOR SELECT
  TO anon
  USING (true);