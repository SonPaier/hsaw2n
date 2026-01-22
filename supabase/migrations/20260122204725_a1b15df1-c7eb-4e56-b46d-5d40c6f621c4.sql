-- Add missing columns for reminder retry/backoff mechanism
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS reminder_1day_last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_1hour_last_attempt_at TIMESTAMPTZ;