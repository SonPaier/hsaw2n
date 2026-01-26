-- Add admin approved amount columns to offers table
ALTER TABLE public.offers ADD COLUMN admin_approved_net numeric;
ALTER TABLE public.offers ADD COLUMN admin_approved_gross numeric;

-- Add comment for documentation
COMMENT ON COLUMN public.offers.admin_approved_net IS 'Admin-approved net amount (has priority over client selection)';
COMMENT ON COLUMN public.offers.admin_approved_gross IS 'Admin-approved gross amount (has priority over client selection)';