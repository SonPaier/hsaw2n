-- Tabela produktów przypisanych do usługi (scope)
CREATE TABLE public.offer_scope_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_id UUID NOT NULL REFERENCES public.offer_scopes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products_library(id) ON DELETE CASCADE,
  variant_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indeksy
CREATE INDEX idx_offer_scope_products_scope_id ON public.offer_scope_products(scope_id);
CREATE INDEX idx_offer_scope_products_instance_id ON public.offer_scope_products(instance_id);

-- RLS
ALTER TABLE public.offer_scope_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view offer scope products for their instance"
ON public.offer_scope_products FOR SELECT
USING (can_access_instance(instance_id));

CREATE POLICY "Users can manage offer scope products for their instance"
ON public.offer_scope_products FOR ALL
USING (can_access_instance(instance_id))
WITH CHECK (can_access_instance(instance_id));

-- Trigger updated_at
CREATE TRIGGER update_offer_scope_products_updated_at
BEFORE UPDATE ON public.offer_scope_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();