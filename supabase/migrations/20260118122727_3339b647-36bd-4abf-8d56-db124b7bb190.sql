-- Make offer_id nullable to support custom reminders not linked to an offer
ALTER TABLE public.offer_reminders ALTER COLUMN offer_id DROP NOT NULL;