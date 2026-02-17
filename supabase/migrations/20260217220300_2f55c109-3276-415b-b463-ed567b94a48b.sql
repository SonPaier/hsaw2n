
CREATE TABLE public.offer_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer DEFAULT 0,
  is_admin_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_offer_views_offer_id ON public.offer_views(offer_id);

ALTER TABLE public.offer_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert offer views"
  ON public.offer_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update own offer views"
  ON public.offer_views FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view offer views"
  ON public.offer_views FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  );
