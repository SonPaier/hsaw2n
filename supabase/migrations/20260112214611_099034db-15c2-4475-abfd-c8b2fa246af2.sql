-- Table for logging customer activity on public reservation links
CREATE TABLE public.reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'viewed' | 'cancelled'
  created_at TIMESTAMPTZ DEFAULT now(),
  instance_id uuid REFERENCES public.instances(id)
);

-- Index for fast analytics queries
CREATE INDEX idx_reservation_events_type_date 
ON public.reservation_events(event_type, created_at);

CREATE INDEX idx_reservation_events_instance 
ON public.reservation_events(instance_id);

-- RLS: super admin can read, anonymous/authenticated can insert (for logging)
ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read reservation_events"
ON public.reservation_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Anyone can insert reservation_events"
ON public.reservation_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.reservation_events IS 'Logs customer activity on public reservation links for analytics';