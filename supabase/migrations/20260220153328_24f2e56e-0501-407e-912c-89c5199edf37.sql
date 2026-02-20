
CREATE TYPE public.training_type AS ENUM ('group_basic', 'individual', 'master');

CREATE TABLE public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL,
  training_type training_type NOT NULL DEFAULT 'individual',
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  station_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_employee_ids JSONB DEFAULT '[]',
  photo_urls TEXT[],
  created_by UUID,
  created_by_username TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trainings" ON public.trainings
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  );

CREATE POLICY "Employees can view trainings" ON public.trainings
  FOR SELECT USING (
    has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  );

CREATE POLICY "Hall can view trainings" ON public.trainings
  FOR SELECT USING (
    has_instance_role(auth.uid(), 'hall'::app_role, instance_id)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.trainings;
