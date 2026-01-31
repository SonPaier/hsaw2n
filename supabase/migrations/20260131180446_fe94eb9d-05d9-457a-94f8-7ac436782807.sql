-- 1) Add SELECT policy so Hall role can view reservations
CREATE POLICY "Hall can view reservations"
ON public.reservations
FOR SELECT
USING (
  has_instance_role(auth.uid(), 'hall'::app_role, instance_id)
);
