-- ===== FAZA 1: Normalizacja numerów telefonów =====
-- Naprawa podwójnych prefiksów typu +4848, 4848, 004848

-- Napraw numery w reservations.customer_phone
UPDATE public.reservations
SET customer_phone = CASE
  -- +4848... -> +48...
  WHEN customer_phone ~ '^\+4848' THEN '+48' || substring(customer_phone from 6)
  -- 4848... (bez +) -> +48...
  WHEN customer_phone ~ '^4848' AND customer_phone !~ '^\+' THEN '+48' || substring(customer_phone from 5)
  -- 004848... -> +48...
  WHEN customer_phone ~ '^004848' THEN '+48' || substring(customer_phone from 7)
  ELSE customer_phone
END
WHERE customer_phone ~ '(\+4848|^4848|^004848)';

-- Napraw numery w customers.phone
UPDATE public.customers
SET phone = CASE
  WHEN phone ~ '^\+4848' THEN '+48' || substring(phone from 6)
  WHEN phone ~ '^4848' AND phone !~ '^\+' THEN '+48' || substring(phone from 5)
  WHEN phone ~ '^004848' THEN '+48' || substring(phone from 7)
  ELSE phone
END
WHERE phone ~ '(\+4848|^4848|^004848)';

-- Napraw numery w offer_reminders.customer_phone
UPDATE public.offer_reminders
SET customer_phone = CASE
  WHEN customer_phone ~ '^\+4848' THEN '+48' || substring(customer_phone from 6)
  WHEN customer_phone ~ '^4848' AND customer_phone !~ '^\+' THEN '+48' || substring(customer_phone from 5)
  WHEN customer_phone ~ '^004848' THEN '+48' || substring(customer_phone from 7)
  ELSE customer_phone
END
WHERE customer_phone ~ '(\+4848|^4848|^004848)';

-- Napraw numery w customer_vehicles.phone
UPDATE public.customer_vehicles
SET phone = CASE
  WHEN phone ~ '^\+4848' THEN '+48' || substring(phone from 6)
  WHEN phone ~ '^4848' AND phone !~ '^\+' THEN '+48' || substring(phone from 5)
  WHEN phone ~ '^004848' THEN '+48' || substring(phone from 7)
  ELSE phone
END
WHERE phone ~ '(\+4848|^4848|^004848)';


-- ===== FAZA 3: Rozszerzenie triggera reset_reminder_flags =====
-- Dodaje reset pól last_attempt_at przy zmianie terminu

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
    NEW.reminder_1day_last_attempt_at := NULL;
    NEW.reminder_1hour_last_attempt_at := NULL;
    -- Reset failure tracking as well
    NEW.reminder_failure_count := 0;
    NEW.reminder_permanent_failure := FALSE;
    NEW.reminder_failure_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;


-- ===== FAZA 4: Kolumny do śledzenia permanent failure =====

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS reminder_failure_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reminder_permanent_failure boolean DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_failure_reason text DEFAULT NULL;

-- Indeks dla wykluczenia permanent failures z zapytań
CREATE INDEX IF NOT EXISTS idx_reservations_permanent_failure 
ON public.reservations (reservation_date, status) 
WHERE reminder_permanent_failure = FALSE OR reminder_permanent_failure IS NULL;