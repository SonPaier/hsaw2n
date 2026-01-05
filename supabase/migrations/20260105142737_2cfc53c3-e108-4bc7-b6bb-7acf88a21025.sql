-- Add offer branding columns to instances table
ALTER TABLE public.instances
ADD COLUMN IF NOT EXISTS offer_branding_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS offer_bg_color text DEFAULT '#f8fafc',
ADD COLUMN IF NOT EXISTS offer_header_bg_color text DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS offer_header_text_color text DEFAULT '#1e293b',
ADD COLUMN IF NOT EXISTS offer_section_bg_color text DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS offer_section_text_color text DEFAULT '#1e293b',
ADD COLUMN IF NOT EXISTS offer_primary_color text DEFAULT '#2563eb';

-- Add comment for documentation
COMMENT ON COLUMN public.instances.offer_branding_enabled IS 'Whether to use custom branding for public offers';
COMMENT ON COLUMN public.instances.offer_bg_color IS 'Background color for the entire offer page';
COMMENT ON COLUMN public.instances.offer_header_bg_color IS 'Background color for the offer header';
COMMENT ON COLUMN public.instances.offer_header_text_color IS 'Text color for the offer header';
COMMENT ON COLUMN public.instances.offer_section_bg_color IS 'Background color for offer sections/cards';
COMMENT ON COLUMN public.instances.offer_section_text_color IS 'Text color for offer sections';
COMMENT ON COLUMN public.instances.offer_primary_color IS 'Primary accent color (buttons, icons, links)';