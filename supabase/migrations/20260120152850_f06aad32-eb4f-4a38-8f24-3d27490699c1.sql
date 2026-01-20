-- Add columns for tracking last reminder attempt timestamps (backoff mechanism)
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS reminder_1hour_last_attempt_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS reminder_1day_last_attempt_at timestamptz NULL;

-- Add index for efficient querying of pending reminders
CREATE INDEX IF NOT EXISTS idx_reservations_reminder_1hour_pending 
ON public.reservations (instance_id, reservation_date, start_time) 
WHERE reminder_1hour_sent IS NULL AND status NOT IN ('cancelled', 'completed', 'no_show');

CREATE INDEX IF NOT EXISTS idx_reservations_reminder_1day_pending 
ON public.reservations (instance_id, reservation_date, start_time) 
WHERE reminder_1day_sent IS NULL AND status NOT IN ('cancelled', 'completed', 'no_show');

-- Comment for documentation
COMMENT ON COLUMN public.reservations.reminder_1hour_last_attempt_at IS 'Timestamp of last attempt to send 1-hour reminder (for backoff/idempotency)';
COMMENT ON COLUMN public.reservations.reminder_1day_last_attempt_at IS 'Timestamp of last attempt to send 1-day reminder (for backoff/idempotency)';