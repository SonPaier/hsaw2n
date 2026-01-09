-- Add bank transfer details columns to instances table
ALTER TABLE public.instances
ADD COLUMN offer_bank_company_name TEXT,
ADD COLUMN offer_bank_account_number TEXT,
ADD COLUMN offer_bank_name TEXT;