-- Create offer_scopes table
CREATE TABLE public.offer_scopes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  has_coating_upsell BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create offer_variants table
CREATE TABLE public.offer_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create offer_scope_variant_products table (links products to scope/variant combinations)
CREATE TABLE public.offer_scope_variant_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  scope_id UUID NOT NULL REFERENCES public.offer_scopes(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.offer_variants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_library(id) ON DELETE SET NULL,
  custom_name TEXT,
  custom_description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'szt',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(scope_id, variant_id, product_id)
);

-- Add scope_id, variant_id, parent_option_id to offer_options for linking
ALTER TABLE public.offer_options 
ADD COLUMN scope_id UUID REFERENCES public.offer_scopes(id) ON DELETE SET NULL,
ADD COLUMN variant_id UUID REFERENCES public.offer_variants(id) ON DELETE SET NULL,
ADD COLUMN parent_option_id UUID REFERENCES public.offer_options(id) ON DELETE SET NULL,
ADD COLUMN is_upsell BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.offer_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_scope_variant_products ENABLE ROW LEVEL SECURITY;

-- RLS policies for offer_scopes
CREATE POLICY "Admins can manage offer scopes"
ON public.offer_scopes FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Anyone can view active scopes"
ON public.offer_scopes FOR SELECT
USING (active = true);

-- RLS policies for offer_variants
CREATE POLICY "Admins can manage offer variants"
ON public.offer_variants FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Anyone can view active variants"
ON public.offer_variants FOR SELECT
USING (active = true);

-- RLS policies for offer_scope_variant_products
CREATE POLICY "Admins can manage scope variant products"
ON public.offer_scope_variant_products FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Anyone can view scope variant products"
ON public.offer_scope_variant_products FOR SELECT
USING (true);

-- Create updated_at triggers
CREATE TRIGGER update_offer_scopes_updated_at
BEFORE UPDATE ON public.offer_scopes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offer_variants_updated_at
BEFORE UPDATE ON public.offer_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offer_scope_variant_products_updated_at
BEFORE UPDATE ON public.offer_scope_variant_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();