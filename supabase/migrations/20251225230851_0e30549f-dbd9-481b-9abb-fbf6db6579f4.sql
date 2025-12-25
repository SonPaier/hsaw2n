-- Create customer_vehicles table
CREATE TABLE public.customer_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  model TEXT NOT NULL,
  plate TEXT,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on phone + model + instance_id
CREATE UNIQUE INDEX idx_customer_vehicles_unique ON public.customer_vehicles (instance_id, phone, model);

-- Enable RLS
ALTER TABLE public.customer_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read vehicles by phone" 
ON public.customer_vehicles 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert vehicles" 
ON public.customer_vehicles 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update vehicles" 
ON public.customer_vehicles 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can manage vehicles" 
ON public.customer_vehicles 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- Trigger for updated_at
CREATE TRIGGER update_customer_vehicles_updated_at
BEFORE UPDATE ON public.customer_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to upsert vehicle (increment usage or insert new)
CREATE OR REPLACE FUNCTION public.upsert_customer_vehicle(
  _instance_id UUID,
  _phone TEXT,
  _model TEXT,
  _plate TEXT DEFAULT NULL,
  _customer_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vehicle_id UUID;
BEGIN
  INSERT INTO public.customer_vehicles (instance_id, phone, model, plate, customer_id, usage_count, last_used_at)
  VALUES (_instance_id, _phone, _model, _plate, _customer_id, 1, now())
  ON CONFLICT (instance_id, phone, model)
  DO UPDATE SET
    usage_count = customer_vehicles.usage_count + 1,
    last_used_at = now(),
    plate = COALESCE(EXCLUDED.plate, customer_vehicles.plate),
    customer_id = COALESCE(EXCLUDED.customer_id, customer_vehicles.customer_id),
    updated_at = now()
  RETURNING id INTO _vehicle_id;
  
  RETURN _vehicle_id;
END;
$$;