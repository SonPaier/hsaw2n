-- Create RPC functions to claim reminders (bypasses PostgREST schema cache)
CREATE OR REPLACE FUNCTION public.claim_reminder_1day(
  p_reservation_id UUID,
  p_now TIMESTAMPTZ,
  p_backoff_threshold TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  UPDATE public.reservations
  SET reminder_1day_last_attempt_at = p_now
  WHERE id = p_reservation_id
    AND reminder_1day_sent IS NULL
    AND (reminder_1day_last_attempt_at IS NULL OR reminder_1day_last_attempt_at < p_backoff_threshold)
  RETURNING id INTO v_updated_id;
  
  RETURN v_updated_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_reminder_1hour(
  p_reservation_id UUID,
  p_now TIMESTAMPTZ,
  p_backoff_threshold TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  UPDATE public.reservations
  SET reminder_1hour_last_attempt_at = p_now
  WHERE id = p_reservation_id
    AND reminder_1hour_sent IS NULL
    AND (reminder_1hour_last_attempt_at IS NULL OR reminder_1hour_last_attempt_at < p_backoff_threshold)
  RETURNING id INTO v_updated_id;
  
  RETURN v_updated_id IS NOT NULL;
END;
$$;