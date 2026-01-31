-- Fix: Postgres does not allow FOR UPDATE with aggregate functions.
-- Our trigger used MAX(entry_number) ... FOR UPDATE which caused inserts/updates to fail.

CREATE OR REPLACE FUNCTION public.set_time_entry_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Lock existing rows for this employee + day to serialize numbering
  PERFORM 1
  FROM public.time_entries
  WHERE employee_id = NEW.employee_id
    AND entry_date = NEW.entry_date
  FOR UPDATE;

  -- Compute next entry_number without FOR UPDATE (aggregate-only query)
  SELECT COALESCE(MAX(entry_number), 0) + 1
  INTO NEW.entry_number
  FROM public.time_entries
  WHERE employee_id = NEW.employee_id
    AND entry_date = NEW.entry_date;

  RETURN NEW;
END;
$$;