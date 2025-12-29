-- Add approved_at column to offers table for tracking when offer was confirmed/accepted
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;