-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create car_models table
CREATE TABLE public.car_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  size TEXT NOT NULL CHECK (size IN ('S', 'M', 'L')),
  active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  UNIQUE(brand, name)
);

-- Indexes for fast searching
CREATE INDEX idx_car_models_brand ON public.car_models(brand);
CREATE INDEX idx_car_models_name_search ON public.car_models USING gin(name gin_trgm_ops);
CREATE INDEX idx_car_models_brand_search ON public.car_models USING gin(brand gin_trgm_ops);
CREATE INDEX idx_car_models_active ON public.car_models(active) WHERE active = true;

-- Enable RLS
ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;

-- Anyone can view active car models (for autocomplete)
CREATE POLICY "Anyone can view active car models" ON public.car_models
  FOR SELECT USING (active = true);

-- Super admins can manage all car models
CREATE POLICY "Super admins can manage car models" ON public.car_models
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_car_models_updated_at
  BEFORE UPDATE ON public.car_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();