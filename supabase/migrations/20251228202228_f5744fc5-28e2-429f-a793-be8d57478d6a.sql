-- Add selected_state column to offers table for storing customer/admin selections
ALTER TABLE public.offers
ADD COLUMN selected_state jsonb DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.offers.selected_state IS 'Stores selected variants, upsells, and optional items. Structure: { selectedVariants: Record<string, string>, selectedUpsells: Record<string, boolean>, selectedOptionalItems: Record<string, boolean> }';