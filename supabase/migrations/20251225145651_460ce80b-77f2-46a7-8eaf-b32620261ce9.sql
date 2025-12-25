-- Add end_date column for multi-day reservations (PPF/folia)
ALTER TABLE public.reservations 
ADD COLUMN end_date date;

-- Set default end_date to reservation_date for existing records
UPDATE public.reservations 
SET end_date = reservation_date 
WHERE end_date IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.reservations.end_date IS 'End date for multi-day reservations (e.g., PPF/folia work). If NULL, same as reservation_date.';