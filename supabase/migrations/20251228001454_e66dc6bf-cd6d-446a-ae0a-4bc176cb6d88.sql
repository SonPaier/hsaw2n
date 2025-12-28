-- Create closed_days table for marking days as closed
CREATE TABLE public.closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  closed_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(instance_id, closed_date)
);

-- Enable RLS
ALTER TABLE public.closed_days ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage closed days"
ON public.closed_days
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Closed days viewable by everyone"
ON public.closed_days
FOR SELECT
USING (true);

-- Add to get_availability_blocks function so closed days block all time slots
CREATE OR REPLACE FUNCTION public.get_availability_blocks(_instance_id uuid, _from date, _to date)
RETURNS TABLE(block_date date, start_time time without time zone, end_time time without time zone, station_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Regular reservations
  SELECT r.reservation_date AS block_date,
         r.start_time,
         r.end_time,
         r.station_id
  FROM public.reservations r
  WHERE r.instance_id = _instance_id
    AND r.reservation_date BETWEEN _from AND _to
    AND (r.status IS NULL OR r.status <> 'cancelled')
    AND EXISTS (
      SELECT 1 FROM public.instances i
      WHERE i.id = _instance_id AND i.active = true
    )

  UNION ALL

  -- Breaks
  SELECT b.break_date AS block_date,
         b.start_time,
         b.end_time,
         b.station_id
  FROM public.breaks b
  WHERE b.instance_id = _instance_id
    AND b.break_date BETWEEN _from AND _to
    AND EXISTS (
      SELECT 1 FROM public.instances i
      WHERE i.id = _instance_id AND i.active = true
    )

  UNION ALL

  -- Closed days block all stations for full day (00:00 to 23:59)
  SELECT cd.closed_date AS block_date,
         '00:00:00'::time AS start_time,
         '23:59:00'::time AS end_time,
         s.id AS station_id
  FROM public.closed_days cd
  CROSS JOIN public.stations s
  WHERE cd.instance_id = _instance_id
    AND cd.closed_date BETWEEN _from AND _to
    AND s.instance_id = _instance_id
    AND s.active = true
    AND EXISTS (
      SELECT 1 FROM public.instances i
      WHERE i.id = _instance_id AND i.active = true
    );
$$;