-- Add phone_verified column to customers table to track verified phone numbers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- Create index for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone_instance ON public.customers(phone, instance_id);

-- Add RLS policy for public read access to check if phone is verified
CREATE POLICY "Anyone can check if phone is verified" 
ON public.customers 
FOR SELECT 
USING (true);