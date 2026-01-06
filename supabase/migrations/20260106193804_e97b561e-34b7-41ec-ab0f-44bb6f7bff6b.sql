-- Security fix: Remove remaining permissive RLS policies
-- Note: offer_scope_* tables are CONFIGURATION tables, not per-offer data
-- They need public read for offer generation, which is acceptable

-- 1. Fix customer_vehicles - remove public read (now handled by edge function)
DROP POLICY IF EXISTS "Anyone can read vehicles by phone" ON public.customer_vehicles;

-- 2. Fix sms_verification_codes - all handled by edge functions
DROP POLICY IF EXISTS "Anyone can read verification by phone" ON public.sms_verification_codes;
DROP POLICY IF EXISTS "Anyone can create verification codes" ON public.sms_verification_codes;
DROP POLICY IF EXISTS "Anyone can update verification status" ON public.sms_verification_codes;

-- 3. Fix sms_logs - only edge functions should insert (they use service role)
DROP POLICY IF EXISTS "System can insert SMS logs" ON public.sms_logs;

-- 4. Fix notifications - remove old permissive policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- 5. Fix offer_history - remove old permissive policy  
DROP POLICY IF EXISTS "System can insert history" ON public.offer_history;

-- 6. Fix offer-related tables - remove duplicate USING (true) policies
-- Keep the proper token-validated ones we already created
DROP POLICY IF EXISTS "Public can view offer options" ON public.offer_options;
DROP POLICY IF EXISTS "Public can view offer items" ON public.offer_option_items;
DROP POLICY IF EXISTS "Public can view offer text blocks" ON public.offer_text_blocks;

-- 7. Fix offers - remove old USING (true) policies
DROP POLICY IF EXISTS "Public can view offer by token" ON public.offers;
DROP POLICY IF EXISTS "Public can update offer via token" ON public.offers;

-- 8. Fix reservations - remove public policies (handled by edge functions)
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can view reservation by confirmation code" ON public.reservations;
DROP POLICY IF EXISTS "Public can update reservation by confirmation code" ON public.reservations;

-- 9. Fix closed_days - restrict to active instances
DROP POLICY IF EXISTS "Closed days viewable by everyone" ON public.closed_days;

CREATE POLICY "Public can view closed days for calendar"
ON public.closed_days FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.instances i
    WHERE i.id = closed_days.instance_id
    AND i.active = true
  )
);

-- 10. Add proper offer policies (replacing USING (true))
CREATE POLICY "Public view offers with token"
ON public.offers FOR SELECT
USING (
  (public_token IS NOT NULL AND status NOT IN ('draft'))
  OR public.can_access_instance(instance_id)
);

CREATE POLICY "Public update offer via token"
ON public.offers FOR UPDATE
USING (public_token IS NOT NULL AND status NOT IN ('draft'))
WITH CHECK (public_token IS NOT NULL AND status NOT IN ('draft'));