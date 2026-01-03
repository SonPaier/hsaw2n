
-- Tabela łącząca offer_scope_extras z produktami
CREATE TABLE public.offer_scope_extra_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  extra_id UUID NOT NULL REFERENCES public.offer_scope_extras(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_library(id) ON DELETE SET NULL,
  custom_name TEXT,
  custom_description TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'szt',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indeksy
CREATE INDEX idx_offer_scope_extra_products_extra ON public.offer_scope_extra_products(extra_id);
CREATE INDEX idx_offer_scope_extra_products_instance ON public.offer_scope_extra_products(instance_id);

-- RLS
ALTER TABLE public.offer_scope_extra_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scope extra products"
ON public.offer_scope_extra_products
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

CREATE POLICY "Anyone can view scope extra products"
ON public.offer_scope_extra_products
FOR SELECT
USING (true);
