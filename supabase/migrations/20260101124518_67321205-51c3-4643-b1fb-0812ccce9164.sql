-- Create yard_vehicles table for vehicles waiting on the yard
CREATE TABLE public.yard_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  car_size public.car_size,
  service_ids JSONB DEFAULT '[]'::jsonb,
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline_time TIME WITHOUT TIME ZONE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.yard_vehicles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage yard vehicles"
ON public.yard_vehicles
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

CREATE POLICY "Yard vehicles viewable by admins"
ON public.yard_vehicles
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_yard_vehicles_updated_at
BEFORE UPDATE ON public.yard_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.yard_vehicles;