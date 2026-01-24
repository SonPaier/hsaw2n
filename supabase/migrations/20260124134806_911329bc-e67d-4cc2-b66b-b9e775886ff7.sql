-- Add missing columns to unified_services
ALTER TABLE public.unified_services 
ADD COLUMN IF NOT EXISTS shortcut TEXT,
ADD COLUMN IF NOT EXISTS price_from NUMERIC,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS station_type TEXT DEFAULT 'washing',
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'reservation' CHECK (service_type IN ('reservation', 'offer'));

-- Add missing columns to unified_categories
ALTER TABLE public.unified_categories 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Migrate shortcut, price_from, duration_minutes, station_type from services to unified_services
UPDATE public.unified_services us
SET 
  shortcut = s.shortcut,
  price_from = s.price_from,
  duration_minutes = s.duration_minutes,
  station_type = COALESCE(s.station_type, 'washing'),
  service_type = 'reservation'
FROM public.services s
WHERE us.id = s.id;

-- Set service_type = 'offer' for products that came from products_library
UPDATE public.unified_services
SET service_type = 'offer'
WHERE id IN (SELECT id FROM public.products_library);

-- Set active = true for all existing unified_categories
UPDATE public.unified_categories
SET active = true
WHERE active IS NULL;

-- Create index for service_type filtering
CREATE INDEX IF NOT EXISTS idx_unified_services_service_type ON public.unified_services(service_type);
CREATE INDEX IF NOT EXISTS idx_unified_services_instance_type ON public.unified_services(instance_id, service_type);
CREATE INDEX IF NOT EXISTS idx_unified_categories_type ON public.unified_categories(instance_id, category_type);