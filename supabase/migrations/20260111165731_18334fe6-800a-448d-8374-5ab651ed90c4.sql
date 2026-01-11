-- Create halls table for multi-hall configuration
CREATE TABLE public.halls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  station_ids UUID[] DEFAULT '{}',
  visible_fields JSONB DEFAULT '{"customer_name": true, "customer_phone": false, "vehicle_plate": true, "services": true, "admin_notes": false}'::jsonb,
  allowed_actions JSONB DEFAULT '{"add_services": false, "change_time": false, "change_station": false}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instance_id, slug)
);

-- Enable RLS
ALTER TABLE public.halls ENABLE ROW LEVEL SECURITY;

-- Admins can manage halls
CREATE POLICY "Admins can manage halls" ON public.halls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND user_roles.instance_id = halls.instance_id)
      )
    )
  );

-- Employees can view halls
CREATE POLICY "Employees can view halls" ON public.halls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role IN ('admin', 'employee') AND user_roles.instance_id = halls.instance_id)
      )
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_halls_updated_at
  BEFORE UPDATE ON public.halls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();