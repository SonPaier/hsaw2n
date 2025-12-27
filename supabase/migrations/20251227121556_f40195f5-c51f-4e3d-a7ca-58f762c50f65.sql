-- =============================================
-- OFFERS MODULE - DATABASE SCHEMA
-- =============================================

-- 1. INSTANCE FEATURES (feature flags per instance)
CREATE TABLE public.instance_features (
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, feature_key)
);

ALTER TABLE public.instance_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage instance features"
ON public.instance_features FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Anyone can read enabled features"
ON public.instance_features FOR SELECT
USING (enabled = true);

-- 2. PRODUCTS LIBRARY (global + per instance)
CREATE TABLE public.products_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.instances(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'instance' CHECK (source IN ('global', 'instance')),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'szt',
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products_library ENABLE ROW LEVEL SECURITY;

-- Global products (instance_id IS NULL) readable by everyone
CREATE POLICY "Global products readable by everyone"
ON public.products_library FOR SELECT
USING (source = 'global' AND instance_id IS NULL AND active = true);

-- Instance products readable by instance admins
CREATE POLICY "Instance products readable by admins"
ON public.products_library FOR SELECT
USING (
  instance_id IS NOT NULL AND 
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
);

-- Admins can manage their instance products
CREATE POLICY "Admins can manage instance products"
ON public.products_library FOR ALL
USING (
  instance_id IS NOT NULL AND
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
);

-- Super admins can manage global products
CREATE POLICY "Super admins can manage global products"
ON public.products_library FOR ALL
USING (source = 'global' AND instance_id IS NULL AND has_role(auth.uid(), 'super_admin'::app_role));

-- 3. TEXT BLOCKS LIBRARY (global + per instance)
CREATE TABLE public.text_blocks_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.instances(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'instance' CHECK (source IN ('global', 'instance')),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'general' CHECK (block_type IN ('header', 'footer', 'terms', 'warranty', 'general')),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.text_blocks_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global text blocks readable by everyone"
ON public.text_blocks_library FOR SELECT
USING (source = 'global' AND instance_id IS NULL AND active = true);

CREATE POLICY "Instance text blocks readable by admins"
ON public.text_blocks_library FOR SELECT
USING (
  instance_id IS NOT NULL AND 
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
);

CREATE POLICY "Admins can manage instance text blocks"
ON public.text_blocks_library FOR ALL
USING (
  instance_id IS NOT NULL AND
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
);

CREATE POLICY "Super admins can manage global text blocks"
ON public.text_blocks_library FOR ALL
USING (source = 'global' AND instance_id IS NULL AND has_role(auth.uid(), 'super_admin'::app_role));

-- 4. OFFERS (main offers table)
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  offer_number TEXT NOT NULL,
  public_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  
  -- Customer data (JSONB for flexibility)
  customer_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: { name, company, phone, email, address, city, postal_code, nip }
  
  -- Vehicle data (optional, for detailing context)
  vehicle_data JSONB DEFAULT NULL,
  -- Structure: { plate, model, size }
  
  -- Totals
  total_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(4,2) NOT NULL DEFAULT 23,
  
  -- Additional info
  notes TEXT,
  payment_terms TEXT,
  valid_until DATE,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Admins can manage their instance offers
CREATE POLICY "Admins can manage offers"
ON public.offers FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- Public can view offer by token (for public offer page)
CREATE POLICY "Public can view offer by token"
ON public.offers FOR SELECT
USING (true);

-- 5. OFFER OPTIONS (packages/sections in offer)
CREATE TABLE public.offer_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_selected BOOLEAN NOT NULL DEFAULT true,
  subtotal_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offer options follow offer access"
ON public.offer_options FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.offers o 
    WHERE o.id = offer_id 
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))
  )
);

CREATE POLICY "Public can view offer options"
ON public.offer_options FOR SELECT
USING (true);

-- 6. OFFER OPTION ITEMS (products in option)
CREATE TABLE public.offer_option_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id UUID NOT NULL REFERENCES public.offer_options(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_library(id) ON DELETE SET NULL,
  
  -- Item data (can override product or be custom)
  custom_name TEXT,
  custom_description TEXT,
  unit TEXT NOT NULL DEFAULT 'szt',
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_option_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offer items follow option access"
ON public.offer_option_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.offer_options oo
    JOIN public.offers o ON o.id = oo.offer_id
    WHERE oo.id = option_id 
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))
  )
);

CREATE POLICY "Public can view offer items"
ON public.offer_option_items FOR SELECT
USING (true);

-- 7. OFFER TEXT BLOCKS (used in specific offer)
CREATE TABLE public.offer_text_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  block_id UUID REFERENCES public.text_blocks_library(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_text_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offer text blocks follow offer access"
ON public.offer_text_blocks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.offers o 
    WHERE o.id = offer_id 
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))
  )
);

CREATE POLICY "Public can view offer text blocks"
ON public.offer_text_blocks FOR SELECT
USING (true);

-- 8. OFFER HISTORY (audit log)
CREATE TABLE public.offer_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.offer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offer history follows offer access"
ON public.offer_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.offers o 
    WHERE o.id = offer_id 
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))
  )
);

CREATE POLICY "System can insert history"
ON public.offer_history FOR INSERT
WITH CHECK (true);

-- 9. INDEXES for performance
CREATE INDEX idx_offers_instance ON public.offers(instance_id);
CREATE INDEX idx_offers_public_token ON public.offers(public_token);
CREATE INDEX idx_offers_status ON public.offers(status);
CREATE INDEX idx_offer_options_offer ON public.offer_options(offer_id);
CREATE INDEX idx_offer_option_items_option ON public.offer_option_items(option_id);
CREATE INDEX idx_products_library_instance ON public.products_library(instance_id);
CREATE INDEX idx_products_library_source ON public.products_library(source);
CREATE INDEX idx_text_blocks_library_instance ON public.text_blocks_library(instance_id);

-- 10. TRIGGERS for updated_at
CREATE TRIGGER update_instance_features_updated_at
BEFORE UPDATE ON public.instance_features
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_library_updated_at
BEFORE UPDATE ON public.products_library
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_text_blocks_library_updated_at
BEFORE UPDATE ON public.text_blocks_library
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offer_options_updated_at
BEFORE UPDATE ON public.offer_options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offer_option_items_updated_at
BEFORE UPDATE ON public.offer_option_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. HELPER FUNCTION: Generate offer number
CREATE OR REPLACE FUNCTION public.generate_offer_number(_instance_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _month TEXT;
  _day TEXT;
  _count INTEGER;
  _prefix TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  _month := to_char(now(), 'MM');
  _day := to_char(now(), 'DD');
  
  -- Count offers for this instance this month
  SELECT COUNT(*) + 1 INTO _count
  FROM public.offers
  WHERE instance_id = _instance_id
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + interval '1 month';
  
  -- Get instance slug for prefix
  SELECT UPPER(LEFT(slug, 3)) INTO _prefix
  FROM public.instances
  WHERE id = _instance_id;
  
  RETURN COALESCE(_prefix, 'OFF') || '/' || _year || '/' || _month || _day || '/' || LPAD(_count::TEXT, 3, '0');
END;
$$;

-- 12. Add setting to instances for disabling global products
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS use_global_products BOOLEAN NOT NULL DEFAULT true;