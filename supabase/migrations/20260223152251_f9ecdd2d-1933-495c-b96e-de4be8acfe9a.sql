
-- Step 1: Add has_no_show column to customers
ALTER TABLE public.customers ADD COLUMN has_no_show boolean NOT NULL DEFAULT false;

-- Step 2: Create trigger function
CREATE OR REPLACE FUNCTION public.update_customer_no_show_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.no_show_at IS NOT NULL AND (OLD.no_show_at IS NULL) THEN
    UPDATE public.customers
    SET has_no_show = true
    WHERE phone = NEW.customer_phone
      AND instance_id = NEW.instance_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Create trigger
CREATE TRIGGER trg_reservation_no_show
  AFTER UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_no_show_flag();

-- Step 4: Backfill existing data (exclude Nastaly/Tomek)
UPDATE public.customers c SET has_no_show = true
WHERE EXISTS (
  SELECT 1 FROM public.reservations r
  WHERE r.customer_phone = c.phone
    AND r.instance_id = c.instance_id
    AND r.no_show_at IS NOT NULL
)
AND c.name NOT ILIKE '%nastaly%'
AND c.name NOT ILIKE '%nastalyax%';
