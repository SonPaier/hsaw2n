-- Table for additional options per scope (like coating upsell but customizable)
CREATE TABLE public.offer_scope_extras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_id uuid NOT NULL REFERENCES public.offer_scopes(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_upsell boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offer_scope_extras ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage scope extras"
ON public.offer_scope_extras FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Anyone can view scope extras"
ON public.offer_scope_extras FOR SELECT
USING (true);