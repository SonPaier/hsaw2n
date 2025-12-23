-- Add subcategory field to services table for grouping within categories
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.services.subcategory IS 'Subcategory for grouping services within a category (e.g., packages, external_elements, internal_elements for PPF)';