-- Add price_from to offer_scopes for widget display
ALTER TABLE public.offer_scopes 
ADD COLUMN IF NOT EXISTS price_from numeric;

-- Add widget_config to instances for widget customization
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS widget_config jsonb DEFAULT '{}'::jsonb;

-- Create paint_colors reference table
CREATE TABLE IF NOT EXISTS public.paint_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  color_code text,
  paint_type text NOT NULL DEFAULT 'standard' CHECK (paint_type IN ('standard', 'matte', 'metallic', 'pearl')),
  color_family text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_paint_colors_name ON public.paint_colors(name);
CREATE INDEX IF NOT EXISTS idx_paint_colors_active ON public.paint_colors(active) WHERE active = true;

-- Enable RLS
ALTER TABLE public.paint_colors ENABLE ROW LEVEL SECURITY;

-- Anyone can read paint colors (public reference data)
CREATE POLICY "Anyone can view paint colors" ON public.paint_colors
  FOR SELECT USING (true);

-- Only super admins can manage paint colors
CREATE POLICY "Super admins can manage paint colors" ON public.paint_colors
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add paint_color and paint_finish to offers for widget submissions
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS paint_color text,
ADD COLUMN IF NOT EXISTS paint_finish text CHECK (paint_finish IN ('gloss', 'matte')),
ADD COLUMN IF NOT EXISTS planned_date date,
ADD COLUMN IF NOT EXISTS inquiry_notes text;

COMMENT ON COLUMN public.offers.paint_color IS 'Customer-provided paint color name from widget';
COMMENT ON COLUMN public.offers.paint_finish IS 'Paint finish type: gloss or matte';
COMMENT ON COLUMN public.offers.planned_date IS 'Customer-requested planned completion date';
COMMENT ON COLUMN public.offers.inquiry_notes IS 'Customer notes/inquiry text from widget submission';
COMMENT ON COLUMN public.offer_scopes.price_from IS 'Starting price displayed in widget for this template';
COMMENT ON COLUMN public.instances.widget_config IS 'Widget configuration: visible templates, extras with custom labels, etc.';