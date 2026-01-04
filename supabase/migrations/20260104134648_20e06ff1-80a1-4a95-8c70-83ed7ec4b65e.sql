-- Add cancelled_by to reservations to track who cancelled the reservation
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS cancelled_by uuid;