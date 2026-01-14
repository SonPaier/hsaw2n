-- Add short_name column to products_library
ALTER TABLE public.products_library
ADD COLUMN IF NOT EXISTS short_name TEXT;