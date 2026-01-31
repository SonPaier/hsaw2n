-- Fix overlap validation to use proper range comparison (exclusive boundaries)
CREATE OR REPLACE FUNCTION public.validate_time_entry_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM time_entries
      WHERE employee_id = NEW.employee_id
        AND entry_date = NEW.entry_date
        AND id != NEW.id
        AND start_time IS NOT NULL AND end_time IS NOT NULL
        AND NEW.start_time < end_time
        AND NEW.end_time > start_time
    ) THEN
      RAISE EXCEPTION 'Time entry overlaps with existing entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;