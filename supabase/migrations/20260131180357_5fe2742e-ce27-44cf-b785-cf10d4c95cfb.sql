-- Allow hall role to update reservation workflow fields, and guard against updating other columns.

-- 1) RLS policy for hall updates (row-level)
DROP POLICY IF EXISTS "Hall can update reservation workflow fields" ON public.reservations;

CREATE POLICY "Hall can update reservation workflow fields"
ON public.reservations
FOR UPDATE
USING (
  has_instance_role(auth.uid(), 'hall'::app_role, instance_id)
)
WITH CHECK (
  has_instance_role(auth.uid(), 'hall'::app_role, instance_id)
);

-- 2) Trigger guard: if the updater is a hall user, only allow specific columns to change
CREATE OR REPLACE FUNCTION public.guard_hall_reservation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_cols text[] := ARRAY[
    'status',
    'started_at',
    'completed_at',
    'checked_service_ids',
    'photo_urls',
    'updated_at'
  ];
  disallowed_cols text[];
BEGIN
  -- Only enforce for hall users of this instance
  IF has_instance_role(auth.uid(), 'hall'::app_role, NEW.instance_id) THEN
    SELECT array_agg(key) INTO disallowed_cols
    FROM (
      SELECT e.key
      FROM jsonb_each(to_jsonb(NEW)) e
      WHERE (to_jsonb(OLD) -> e.key) IS DISTINCT FROM e.value
    ) changed
    WHERE NOT (changed.key = ANY(allowed_cols));

    IF disallowed_cols IS NOT NULL THEN
      RAISE EXCEPTION 'Hall role cannot update columns: %', disallowed_cols
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_hall_reservation_update ON public.reservations;

CREATE TRIGGER trg_guard_hall_reservation_update
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.guard_hall_reservation_update();
