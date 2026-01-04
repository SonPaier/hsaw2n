-- Add customer_edit_cutoff_hours to instances (how many hours before visit customer can edit)
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS customer_edit_cutoff_hours INTEGER DEFAULT 1;

-- Add edited_by_customer_at to reservations (timestamp when customer last edited)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS edited_by_customer_at TIMESTAMP WITH TIME ZONE;

-- Create unique index on confirmation_code for ALL reservations (no recycling)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_confirmation_code 
ON public.reservations(confirmation_code) 
WHERE confirmation_code IS NOT NULL;