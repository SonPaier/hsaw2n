-- Add source column to customers table to distinguish between car wash and offer customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'myjnia';

-- Add company and nip columns for offer customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS nip text,
ADD COLUMN IF NOT EXISTS address text;

-- Create index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_customers_source ON public.customers(instance_id, source);