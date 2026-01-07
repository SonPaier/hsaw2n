-- Fix RPC type mismatch: start_time/end_time are TIME but function used TEXT
-- Drop old overload (text/date/time passed as TEXT)
DROP FUNCTION IF EXISTS public.request_reservation_change_by_code(text, text, text, uuid, uuid);

-- Recreate with proper parameter types so PostgREST casts correctly from JSON strings
CREATE OR REPLACE FUNCTION public.request_reservation_change_by_code(
  _original_confirmation_code text,
  _new_reservation_date date,
  _new_start_time time without time zone,
  _new_service_id uuid,
  _new_station_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, confirmation_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _orig record;
  _duration_minutes integer;
  _new_end_time time without time zone;
  _new_id uuid;
  _new_code text;
  _attempts int := 0;
  _cutoff_hours int;
BEGIN
  -- Find original reservation by code
  SELECT r.*
  INTO _orig
  FROM public.reservations r
  WHERE r.confirmation_code = _original_confirmation_code
  LIMIT 1;

  IF _orig.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  -- Only allow edits for active reservations
  IF _orig.status NOT IN ('confirmed', 'pending') THEN
    RAISE EXCEPTION 'RESERVATION_NOT_EDITABLE';
  END IF;

  -- Enforce customer edit cutoff (same rule as UI)
  SELECT COALESCE(i.customer_edit_cutoff_hours, 1)
  INTO _cutoff_hours
  FROM public.instances i
  WHERE i.id = _orig.instance_id;

  IF (_orig.reservation_date::date + _orig.start_time) < (now() + make_interval(hours => _cutoff_hours)) THEN
    RAISE EXCEPTION 'EDIT_CUTOFF_PASSED';
  END IF;

  -- Block multiple pending change requests
  IF EXISTS (
    SELECT 1
    FROM public.reservations cr
    WHERE cr.original_reservation_id = _orig.id
      AND cr.status = 'change_requested'
  ) THEN
    RAISE EXCEPTION 'ALREADY_HAS_PENDING_CHANGE';
  END IF;

  -- Validate service belongs to the same instance and get duration (car size aware)
  SELECT
    COALESCE(
      CASE _orig.car_size::text
        WHEN 'small' THEN COALESCE(s.duration_small, s.duration_minutes)
        WHEN 'medium' THEN COALESCE(s.duration_medium, s.duration_minutes)
        WHEN 'large' THEN COALESCE(s.duration_large, s.duration_minutes)
        ELSE s.duration_minutes
      END,
      s.duration_minutes,
      60
    )
  INTO _duration_minutes
  FROM public.services s
  WHERE s.id = _new_service_id
    AND s.instance_id = _orig.instance_id
  LIMIT 1;

  IF _duration_minutes IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  -- Compute end time based on start time + duration
  _new_end_time := (_new_start_time + make_interval(mins => _duration_minutes))::time;

  -- Generate unique 7-digit confirmation code
  LOOP
    _new_code := (floor(random() * 9000000) + 1000000)::bigint::text;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.reservations r2 WHERE r2.confirmation_code = _new_code
    );

    _attempts := _attempts + 1;
    IF _attempts > 20 THEN
      RAISE EXCEPTION 'CODE_GENERATION_FAILED';
    END IF;
  END LOOP;

  -- Insert change request reservation (original stays untouched)
  INSERT INTO public.reservations (
    instance_id,
    reservation_date,
    start_time,
    end_time,
    station_id,
    service_id,
    service_ids,
    customer_name,
    customer_phone,
    vehicle_plate,
    car_size,
    customer_notes,
    confirmation_code,
    status,
    original_reservation_id,
    source
  ) VALUES (
    _orig.instance_id,
    _new_reservation_date,
    _new_start_time,
    _new_end_time,
    _new_station_id,
    _new_service_id,
    jsonb_build_array(_new_service_id),
    _orig.customer_name,
    _orig.customer_phone,
    _orig.vehicle_plate,
    _orig.car_size,
    _orig.customer_notes,
    _new_code,
    'change_requested',
    _orig.id,
    'customer'
  )
  RETURNING reservations.id, reservations.confirmation_code
  INTO _new_id, _new_code;

  -- Create notification for admins
  INSERT INTO public.notifications (instance_id, type, title, description, entity_type, entity_id)
  SELECT
    _orig.instance_id,
    'change_request',
    'Prośba o zmianę terminu: ' || _orig.customer_name,
    COALESCE(s.name, 'Usługa') || ' - ' || to_char(_new_reservation_date, 'YYYY-MM-DD') || ' o ' || to_char(_new_start_time, 'HH24:MI'),
    'reservation',
    _new_id
  FROM public.services s
  WHERE s.id = _new_service_id;

  RETURN QUERY SELECT _new_id, _new_code;
END;
$function$;

-- Keep RPC callable from the public client
GRANT EXECUTE ON FUNCTION public.request_reservation_change_by_code(text, date, time without time zone, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.request_reservation_change_by_code(text, date, time without time zone, uuid, uuid) TO authenticated;
