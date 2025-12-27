-- Add metadata column to products_library for flexible attributes (thickness, durability, color, dimensions, etc.)
ALTER TABLE public.products_library 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add brand/manufacturer column
ALTER TABLE public.products_library 
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Create price_lists table to track uploaded price list files
CREATE TABLE public.price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'xlsx', 'xls'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  products_count INTEGER DEFAULT 0,
  extracted_at TIMESTAMPTZ,
  error_message TEXT,
  is_global BOOLEAN DEFAULT false, -- true = super admin uploaded, available to all
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on price_lists
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins full access on price_lists"
ON public.price_lists
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Instance admins can manage their own price lists
CREATE POLICY "Instance admins can view own price_lists"
ON public.price_lists
FOR SELECT
USING (
  instance_id IS NOT NULL AND 
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

CREATE POLICY "Instance admins can view global price_lists"
ON public.price_lists
FOR SELECT
USING (is_global = true);

CREATE POLICY "Instance admins can insert own price_lists"
ON public.price_lists
FOR INSERT
WITH CHECK (
  instance_id IS NOT NULL AND 
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id) AND
  is_global = false
);

CREATE POLICY "Instance admins can update own price_lists"
ON public.price_lists
FOR UPDATE
USING (
  instance_id IS NOT NULL AND 
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id) AND
  is_global = false
);

CREATE POLICY "Instance admins can delete own price_lists"
ON public.price_lists
FOR DELETE
USING (
  instance_id IS NOT NULL AND 
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id) AND
  is_global = false
);

-- Create storage bucket for price list files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('price-lists', 'price-lists', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for price-lists bucket
CREATE POLICY "Authenticated users can upload price lists"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'price-lists' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their price lists"
ON storage.objects FOR SELECT
USING (bucket_id = 'price-lists' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their price lists"
ON storage.objects FOR DELETE
USING (bucket_id = 'price-lists' AND auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_price_lists_updated_at
BEFORE UPDATE ON public.price_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_price_lists_instance_id ON public.price_lists(instance_id);
CREATE INDEX idx_price_lists_is_global ON public.price_lists(is_global);
CREATE INDEX idx_products_library_brand ON public.products_library(brand);