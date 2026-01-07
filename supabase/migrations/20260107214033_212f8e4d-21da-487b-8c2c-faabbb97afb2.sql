-- Update the cancel function to also create a notification
CREATE OR REPLACE FUNCTION public.cancel_reservation_by_code(_confirmation_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reservation record;
BEGIN
  -- Find and update the reservation
  UPDATE public.reservations
  SET status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  WHERE confirmation_code = _confirmation_code
    AND status NOT IN ('cancelled', 'completed')
  RETURNING id, instance_id, customer_name, reservation_date, start_time, service_id INTO _reservation;
  
  -- If reservation was found and updated, create notification
  IF _reservation.id IS NOT NULL THEN
    INSERT INTO public.notifications (instance_id, type, title, description, entity_type, entity_id)
    SELECT 
      _reservation.instance_id,
      'reservation_cancelled_by_customer',
      'Klient anulował rezerwację: ' || _reservation.customer_name,
      s.name || ' - ' || to_char(_reservation.reservation_date, 'DD Mon') || ' o ' || substring(_reservation.start_time::text from 1 for 5),
      'reservation',
      _reservation.id
    FROM public.services s
    WHERE s.id = _reservation.service_id;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;