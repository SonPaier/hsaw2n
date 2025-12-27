-- Add salesperson fields to price_lists table
ALTER TABLE public.price_lists
ADD COLUMN IF NOT EXISTS salesperson_name text,
ADD COLUMN IF NOT EXISTS salesperson_email text,
ADD COLUMN IF NOT EXISTS salesperson_phone text;