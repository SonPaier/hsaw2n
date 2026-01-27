-- Add source column to offers table
ALTER TABLE public.offers
ADD COLUMN source text DEFAULT 'admin';

-- Add comment for documentation
COMMENT ON COLUMN public.offers.source IS 'Source of the offer: admin, website, etc.';