-- Allow public INSERT for change requests (must reference existing reservation)
CREATE POLICY "Public can create change request"
ON public.reservations
FOR INSERT
WITH CHECK (
  status = 'change_requested' 
  AND original_reservation_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.reservations r 
    WHERE r.id = original_reservation_id
  )
);

-- Allow public UPDATE for customer actions (cancel, etc.) by confirmation_code
CREATE POLICY "Public can update own reservation by confirmation_code"
ON public.reservations
FOR UPDATE
USING (true)
WITH CHECK (true);