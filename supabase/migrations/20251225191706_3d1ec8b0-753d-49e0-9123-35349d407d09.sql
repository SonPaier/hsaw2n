-- Add auto_confirm_reservations setting to instances table
ALTER TABLE public.instances 
ADD COLUMN auto_confirm_reservations boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.instances.auto_confirm_reservations IS 'If true, reservations are automatically confirmed. If false, admin must manually confirm each reservation.';