-- Add warranty and service_info columns to offers table
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS warranty text,
ADD COLUMN IF NOT EXISTS service_info text;