-- Create breaks table for calendar breaks/pauses
CREATE TABLE public.breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  station_id UUID REFERENCES public.stations(id) ON DELETE CASCADE,
  break_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;

-- Admins can manage breaks
CREATE POLICY "Admins can manage breaks"
ON public.breaks
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

-- Breaks viewable by admins
CREATE POLICY "Breaks viewable by admins"
ON public.breaks
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
);

-- Create index for faster queries
CREATE INDEX idx_breaks_instance_date ON public.breaks(instance_id, break_date);
CREATE INDEX idx_breaks_station ON public.breaks(station_id);

-- Add trigger for updated_at
CREATE TRIGGER update_breaks_updated_at
BEFORE UPDATE ON public.breaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();