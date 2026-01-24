-- ============================================
-- FAZA 1: Tworzenie nowych tabel
-- ============================================

-- 1.1 Tabela unified_categories
CREATE TABLE public.unified_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  category_type TEXT NOT NULL CHECK (category_type IN ('reservation', 'offer')),
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  prices_are_net BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeksy dla unified_categories
CREATE INDEX idx_unified_categories_instance_id ON public.unified_categories(instance_id);
CREATE INDEX idx_unified_categories_type ON public.unified_categories(category_type);
CREATE INDEX idx_unified_categories_deleted ON public.unified_categories(deleted_at) WHERE deleted_at IS NULL;

-- 1.2 Tabela unified_services
CREATE TABLE public.unified_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.unified_categories(id) ON DELETE SET NULL,
  
  -- Dane bazowe
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  
  -- Ceny rezerwacji (per rozmiar)
  price_small NUMERIC(10,2),
  price_medium NUMERIC(10,2),
  price_large NUMERIC(10,2),
  
  -- Cena ofertowa (domyślna)
  default_price NUMERIC(10,2) DEFAULT 0,
  
  -- Czasy trwania (minuty, per rozmiar)
  duration_small INTEGER,
  duration_medium INTEGER,
  duration_large INTEGER,
  
  -- Flagi
  requires_size BOOLEAN DEFAULT false,
  is_popular BOOLEAN DEFAULT false,
  prices_are_net BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  
  -- Warunki ofertowe
  default_validity_days INTEGER,
  default_payment_terms TEXT,
  default_warranty_terms TEXT,
  default_service_info TEXT,
  
  -- Sortowanie i unit
  sort_order INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'szt',
  
  -- Metadata (legacy_subcategory, brand, itp.)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeksy dla unified_services
CREATE INDEX idx_unified_services_instance_id ON public.unified_services(instance_id);
CREATE INDEX idx_unified_services_category_id ON public.unified_services(category_id);
CREATE INDEX idx_unified_services_deleted ON public.unified_services(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_unified_services_active ON public.unified_services(active) WHERE active = true;

-- Trigger dla updated_at
CREATE TRIGGER update_unified_categories_updated_at
  BEFORE UPDATE ON public.unified_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_unified_services_updated_at
  BEFORE UPDATE ON public.unified_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS dla unified_categories
ALTER TABLE public.unified_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories for their instance"
  ON public.unified_categories FOR SELECT
  USING (public.can_access_instance(instance_id));

CREATE POLICY "Admins can manage categories"
  ON public.unified_categories FOR ALL
  USING (public.can_access_instance(instance_id));

-- RLS dla unified_services
ALTER TABLE public.unified_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view services for their instance"
  ON public.unified_services FOR SELECT
  USING (public.can_access_instance(instance_id));

CREATE POLICY "Admins can manage services"
  ON public.unified_services FOR ALL
  USING (public.can_access_instance(instance_id));