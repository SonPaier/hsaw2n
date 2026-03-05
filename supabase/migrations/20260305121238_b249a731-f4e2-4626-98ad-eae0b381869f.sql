
-- Sales orders table
CREATE TABLE public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.instances(id),
  customer_id uuid REFERENCES public.customers(id),
  order_number text NOT NULL,
  customer_name text NOT NULL,
  city text,
  contact_person text,
  total_net numeric NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PLN',
  comment text,
  status text NOT NULL DEFAULT 'nowy',
  tracking_number text,
  shipped_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sales order items table
CREATE TABLE public.sales_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_net numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_orders
CREATE POLICY "Admins can manage sales orders"
  ON public.sales_orders
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- RLS policies for sales_order_items
CREATE POLICY "Admins can manage sales order items"
  ON public.sales_order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
      WHERE so.id = sales_order_items.order_id
      AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, so.instance_id))
    )
  );
