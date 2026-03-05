
-- Sales products table
CREATE TABLE public.sales_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid REFERENCES public.instances(id) NOT NULL,
  full_name text NOT NULL,
  short_name text NOT NULL,
  description text,
  price_net numeric NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'piece',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage sales products for their instance"
  ON public.sales_products
  FOR ALL
  TO authenticated
  USING (public.can_access_instance(instance_id))
  WITH CHECK (public.can_access_instance(instance_id));

-- Add vehicle field to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS vehicle text;
