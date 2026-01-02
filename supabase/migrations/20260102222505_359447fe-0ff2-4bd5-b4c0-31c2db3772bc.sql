-- Add invoice_company_name column to instances table
ALTER TABLE public.instances
ADD COLUMN invoice_company_name TEXT;