-- Dodanie kolumn do śledzenia wysłanych przypomnień
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS reminder_1day_sent boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reminder_1hour_sent boolean DEFAULT NULL;

-- Indeksy dla szybkiego wyszukiwania rezerwacji wymagających przypomnień
CREATE INDEX IF NOT EXISTS idx_reservations_reminder_1day 
ON public.reservations (reservation_date, status) 
WHERE reminder_1day_sent IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_reminder_1hour 
ON public.reservations (reservation_date, start_time, status) 
WHERE reminder_1hour_sent IS NULL;

-- Funkcja resetująca flagi przypomnień przy zmianie terminu
CREATE OR REPLACE FUNCTION public.reset_reminder_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Reset flags when reservation date or time changes
  IF (OLD.reservation_date IS DISTINCT FROM NEW.reservation_date) OR 
     (OLD.start_time IS DISTINCT FROM NEW.start_time) THEN
    NEW.reminder_1day_sent := NULL;
    NEW.reminder_1hour_sent := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger resetujący flagi przy aktualizacji rezerwacji
DROP TRIGGER IF EXISTS trigger_reset_reminder_flags ON public.reservations;
CREATE TRIGGER trigger_reset_reminder_flags
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.reset_reminder_flags();