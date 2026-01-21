-- Create table for product categories management
CREATE TABLE public.offer_product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offer_product_categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage product categories"
ON public.offer_product_categories
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Anyone can view active categories"
ON public.offer_product_categories
FOR SELECT
USING (active = true);

-- Trigger for updated_at
CREATE TRIGGER update_offer_product_categories_updated_at
BEFORE UPDATE ON public.offer_product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Arm Car categories
INSERT INTO public.offer_product_categories (instance_id, name, sort_order) VALUES
('4ce15650-76c7-47e7-b5c8-32b9a2d1c321', 'MYJNIA SAMOCHODOWA', 0),
('4ce15650-76c7-47e7-b5c8-32b9a2d1c321', 'KOREKTA LAKIERU', 1),
('4ce15650-76c7-47e7-b5c8-32b9a2d1c321', 'POWŁOKI OCHRONNE', 2),
('4ce15650-76c7-47e7-b5c8-32b9a2d1c321', 'DETAILING WNĘTRZA', 3),
('4ce15650-76c7-47e7-b5c8-32b9a2d1c321', 'WRAPPING - FOLIA PPF', 4);