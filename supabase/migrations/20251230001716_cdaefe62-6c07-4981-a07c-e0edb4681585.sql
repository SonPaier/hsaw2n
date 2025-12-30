-- Add service_ids column to store multiple services as JSON array
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS service_ids jsonb DEFAULT '[]'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_reservations_service_ids ON public.reservations USING GIN (service_ids);