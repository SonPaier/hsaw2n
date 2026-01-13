-- Add default offer values columns to products_library
ALTER TABLE public.products_library
ADD COLUMN IF NOT EXISTS default_validity_days INTEGER,
ADD COLUMN IF NOT EXISTS default_payment_terms TEXT,
ADD COLUMN IF NOT EXISTS default_warranty_terms TEXT,
ADD COLUMN IF NOT EXISTS default_service_info TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.products_library.default_validity_days IS 'Default offer validity period in days for this product';
COMMENT ON COLUMN public.products_library.default_payment_terms IS 'Default payment terms text for offers with this product';
COMMENT ON COLUMN public.products_library.default_warranty_terms IS 'Default warranty terms text for offers with this product';
COMMENT ON COLUMN public.products_library.default_service_info IS 'Default service info text for offers with this product';