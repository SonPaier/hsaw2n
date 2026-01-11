-- Drop existing status check constraint and add new one with 'completed' status
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_status_check;

ALTER TABLE public.offers ADD CONSTRAINT offers_status_check 
CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'completed'));