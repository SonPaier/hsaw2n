-- Create vehicle_protocols table
CREATE TABLE public.vehicle_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  offer_number TEXT,
  customer_name TEXT NOT NULL,
  vehicle_model TEXT,
  nip TEXT,
  phone TEXT,
  registration_number TEXT,
  fuel_level INTEGER CHECK (fuel_level >= 0 AND fuel_level <= 100),
  odometer_reading INTEGER,
  body_type TEXT NOT NULL DEFAULT 'sedan',
  protocol_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by TEXT,
  customer_signature TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create protocol_damage_points table
CREATE TABLE public.protocol_damage_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES public.vehicle_protocols(id) ON DELETE CASCADE,
  view TEXT NOT NULL CHECK (view IN ('front', 'rear', 'left', 'right')),
  x_percent DECIMAL(5,2) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent DECIMAL(5,2) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  damage_type TEXT,
  custom_note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_vehicle_protocols_instance_id ON public.vehicle_protocols(instance_id);
CREATE INDEX idx_vehicle_protocols_offer_id ON public.vehicle_protocols(offer_id);
CREATE INDEX idx_protocol_damage_points_protocol_id ON public.protocol_damage_points(protocol_id);

-- Enable RLS
ALTER TABLE public.vehicle_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_damage_points ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehicle_protocols
CREATE POLICY "Users can view protocols of their instance"
  ON public.vehicle_protocols
  FOR SELECT
  USING (can_access_instance(instance_id));

CREATE POLICY "Users can create protocols for their instance"
  ON public.vehicle_protocols
  FOR INSERT
  WITH CHECK (can_access_instance(instance_id));

CREATE POLICY "Users can update protocols of their instance"
  ON public.vehicle_protocols
  FOR UPDATE
  USING (can_access_instance(instance_id));

CREATE POLICY "Users can delete protocols of their instance"
  ON public.vehicle_protocols
  FOR DELETE
  USING (can_access_instance(instance_id));

-- RLS policies for protocol_damage_points (via protocol)
CREATE POLICY "Users can view damage points of their protocols"
  ON public.protocol_damage_points
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.vehicle_protocols vp
    WHERE vp.id = protocol_id AND can_access_instance(vp.instance_id)
  ));

CREATE POLICY "Users can create damage points for their protocols"
  ON public.protocol_damage_points
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.vehicle_protocols vp
    WHERE vp.id = protocol_id AND can_access_instance(vp.instance_id)
  ));

CREATE POLICY "Users can update damage points of their protocols"
  ON public.protocol_damage_points
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.vehicle_protocols vp
    WHERE vp.id = protocol_id AND can_access_instance(vp.instance_id)
  ));

CREATE POLICY "Users can delete damage points of their protocols"
  ON public.protocol_damage_points
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.vehicle_protocols vp
    WHERE vp.id = protocol_id AND can_access_instance(vp.instance_id)
  ));

-- Create storage bucket for protocol photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('protocol-photos', 'protocol-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for protocol-photos bucket
CREATE POLICY "Authenticated users can upload protocol photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'protocol-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view protocol photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'protocol-photos');

CREATE POLICY "Authenticated users can update protocol photos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'protocol-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete protocol photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'protocol-photos' AND auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_vehicle_protocols_updated_at
  BEFORE UPDATE ON public.vehicle_protocols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();