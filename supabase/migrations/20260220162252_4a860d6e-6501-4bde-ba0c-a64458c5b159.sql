
-- Create training_types table for custom training types per instance
CREATE TABLE public.training_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  name TEXT NOT NULL,
  duration_days NUMERIC(3,1) NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage training types"
ON public.training_types FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Employees can view training types"
ON public.training_types FOR SELECT
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Hall can view training types"
ON public.training_types FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- Add training_type_id column to trainings table (nullable FK to training_types)
ALTER TABLE public.trainings
ADD COLUMN training_type_id UUID REFERENCES public.training_types(id);

-- Seed default training types for all instances that have trainings
INSERT INTO public.training_types (instance_id, name, duration_days, sort_order)
SELECT DISTINCT t.instance_id, 'Grupowe podstawowe', 1, 0
FROM public.trainings t
ON CONFLICT DO NOTHING;

INSERT INTO public.training_types (instance_id, name, duration_days, sort_order)
SELECT DISTINCT t.instance_id, 'Indywidualne', 2, 1
FROM public.trainings t
ON CONFLICT DO NOTHING;

INSERT INTO public.training_types (instance_id, name, duration_days, sort_order)
SELECT DISTINCT t.instance_id, 'MASTER z instruktorem', 2, 2
FROM public.trainings t
ON CONFLICT DO NOTHING;

-- Enable realtime for training_types
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_types;
