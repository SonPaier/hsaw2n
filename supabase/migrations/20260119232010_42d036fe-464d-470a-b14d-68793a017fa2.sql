-- Add protocol email template column to instances
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS protocol_email_template TEXT;