-- Drop the policy with USING (true) - it's too permissive
DROP POLICY IF EXISTS "Public can cancel own reservation by confirmation_code" ON public.reservations;

-- Create a SECURITY DEFINER function to handle customer cancellation
CREATE OR REPLACE FUNCTION public.cancel_reservation_by_code(_confirmation_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reservation_id uuid;
BEGIN
  -- Find and update the reservation
  UPDATE public.reservations
  SET status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  WHERE confirmation_code = _confirmation_code
    AND status NOT IN ('cancelled', 'completed')
  RETURNING id INTO _reservation_id;
  
  -- Return true if reservation was found and updated
  RETURN _reservation_id IS NOT NULL;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.cancel_reservation_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_by_code(text) TO authenticated;