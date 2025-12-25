-- Add source column to track where reservation was created
ALTER TABLE public.reservations 
ADD COLUMN source text DEFAULT 'admin' CHECK (source IN ('admin', 'customer'));

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.source IS 'Source of reservation: admin (created by admin panel) or customer (created via public booking page)';