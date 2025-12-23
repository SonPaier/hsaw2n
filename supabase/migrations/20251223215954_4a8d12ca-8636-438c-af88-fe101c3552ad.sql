-- Create customers table for storing customer data
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(instance_id, phone)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Admins can manage customers for their instance
CREATE POLICY "Admins can manage customers"
ON public.customers
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

-- Customers are viewable by admins
CREATE POLICY "Customers viewable by admins"
ON public.customers
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();