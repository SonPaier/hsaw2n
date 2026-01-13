-- Add short_name column to offer_scopes
ALTER TABLE public.offer_scopes
ADD COLUMN short_name TEXT;