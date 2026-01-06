-- Security fix: Replace permissive INSERT policies with secure triggers

-- 1. Remove permissive INSERT policy from notifications
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

-- 2. Remove permissive INSERT policy from offer_history  
DROP POLICY IF EXISTS "Anyone can create offer history" ON public.offer_history;
DROP POLICY IF EXISTS "Anyone can insert offer history" ON public.offer_history;

-- 3. Create trigger function to auto-create notification on new reservation
CREATE OR REPLACE FUNCTION public.create_reservation_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create notification for new online reservations
  IF NEW.source = 'online' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (instance_id, type, title, message, data, is_read)
    VALUES (
      NEW.instance_id,
      'new_reservation',
      'Nowa rezerwacja online',
      'Klient ' || COALESCE(NEW.customer_name, 'Nieznany') || ' zarezerwował wizytę na ' || to_char(NEW.reservation_date, 'DD.MM.YYYY') || ' o ' || NEW.start_time::text,
      jsonb_build_object('reservation_id', NEW.id, 'customer_phone', NEW.customer_phone),
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create trigger for reservation notifications
DROP TRIGGER IF EXISTS trigger_reservation_notification ON public.reservations;
CREATE TRIGGER trigger_reservation_notification
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.create_reservation_notification();

-- 5. Create trigger function to auto-log offer history changes
CREATE OR REPLACE FUNCTION public.create_offer_history_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _changed_fields jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _changed_fields := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine action based on status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := 'status_changed_to_' || NEW.status;
    ELSE
      _action := 'updated';
    END IF;
    -- Log only changed fields
    _changed_fields := jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_total', OLD.total_price,
      'new_total', NEW.total_price
    );
  END IF;

  INSERT INTO public.offer_history (offer_id, action, changed_by, changed_fields)
  VALUES (
    NEW.id,
    _action,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    _changed_fields
  );

  RETURN NEW;
END;
$$;

-- 6. Create trigger for offer history
DROP TRIGGER IF EXISTS trigger_offer_history ON public.offers;
CREATE TRIGGER trigger_offer_history
AFTER INSERT OR UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.create_offer_history_entry();

-- 7. Add secure INSERT policies that only allow authenticated users with proper roles
CREATE POLICY "Admins can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  public.can_access_instance(instance_id)
);

CREATE POLICY "System can create offer history via trigger"
ON public.offer_history FOR INSERT
WITH CHECK (
  -- Allow trigger-based inserts (changed_by will be set by trigger)
  -- Or authenticated users with instance access
  EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_history.offer_id
    AND public.can_access_instance(o.instance_id)
  )
);