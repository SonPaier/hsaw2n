-- Table to link scopes with their allowed variants
CREATE TABLE public.offer_scope_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_id uuid NOT NULL REFERENCES public.offer_scopes(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.offer_variants(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(scope_id, variant_id)
);

-- Enable RLS
ALTER TABLE public.offer_scope_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage scope variants"
ON public.offer_scope_variants FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Anyone can view scope variants"
ON public.offer_scope_variants FOR SELECT
USING (true);