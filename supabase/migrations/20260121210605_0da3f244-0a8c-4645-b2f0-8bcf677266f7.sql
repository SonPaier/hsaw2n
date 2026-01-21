-- Add service_items JSONB column to reservations table
-- This will store array of objects: [{service_id: uuid, custom_price: number}]
-- Old reservations with only service_ids will continue to work (backward compatible)

ALTER TABLE public.reservations 
ADD COLUMN service_items jsonb DEFAULT '[]'::jsonb;

-- Add a comment to document the expected structure
COMMENT ON COLUMN public.reservations.service_items IS 'Array of service items with custom prices: [{service_id: uuid, custom_price: number}]. Falls back to service_ids for backward compatibility.';