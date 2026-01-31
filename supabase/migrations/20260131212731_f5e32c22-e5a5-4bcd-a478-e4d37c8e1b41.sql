-- 1) Fix SECURITY DEFINER functions missing search_path
ALTER FUNCTION public.create_offer_reminders(uuid, timestamp with time zone)
SET search_path = public;

ALTER FUNCTION public.create_reservation_reminders(uuid)
SET search_path = public;

-- 2) Move pg_trgm extension out of public schema (recommended hardening)
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Ensure common roles can still use extension functions without schema prefix
ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions;

-- 3) Replace overly-permissive reservation_events INSERT policy
-- Create helper to validate instance_id against reservation_id (avoids needing auth)
CREATE OR REPLACE FUNCTION public.get_reservation_instance_id(p_reservation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT instance_id FROM public.reservations WHERE id = p_reservation_id
$$;

DROP POLICY IF EXISTS "Anyone can insert reservation_events" ON public.reservation_events;

CREATE POLICY "Public can insert reservation_events"
ON public.reservation_events
FOR INSERT
WITH CHECK (
  reservation_id IS NOT NULL
  AND instance_id IS NOT NULL
  AND instance_id = public.get_reservation_instance_id(reservation_id)
  AND event_type IN ('viewed', 'cancelled')
);
