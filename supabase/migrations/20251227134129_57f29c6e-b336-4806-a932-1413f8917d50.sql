-- Add hide_unit_prices column to offers table
ALTER TABLE public.offers 
ADD COLUMN hide_unit_prices boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.offers.hide_unit_prices IS 'When true, unit prices are hidden in public view - only totals are shown';