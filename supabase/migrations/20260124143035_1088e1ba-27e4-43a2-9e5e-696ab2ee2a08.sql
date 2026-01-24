-- Add flag to offers table to determine which service list to use in drawer
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS has_unified_services BOOLEAN DEFAULT false;

-- Add flag to reservations table as well for consistency
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS has_unified_services BOOLEAN DEFAULT false;

-- Add comments explaining the logic
COMMENT ON COLUMN public.offers.has_unified_services IS 
'When true, use unified_services with service_type=both in drawer. When false/null, use legacy service_type=offer for backward compatibility.';

COMMENT ON COLUMN public.reservations.has_unified_services IS 
'When true, use unified_services with service_type=both in drawer. When false/null, use legacy service_type=reservation for backward compatibility.';