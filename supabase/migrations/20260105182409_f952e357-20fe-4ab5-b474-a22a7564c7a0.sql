-- Add default offer settings fields to instances table
ALTER TABLE public.instances
ADD COLUMN IF NOT EXISTS offer_default_payment_terms TEXT,
ADD COLUMN IF NOT EXISTS offer_default_notes TEXT,
ADD COLUMN IF NOT EXISTS offer_default_warranty TEXT,
ADD COLUMN IF NOT EXISTS offer_default_service_info TEXT,
ADD COLUMN IF NOT EXISTS offer_email_template TEXT;