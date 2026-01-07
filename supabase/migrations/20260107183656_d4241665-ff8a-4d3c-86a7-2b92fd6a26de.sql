-- Drop the old trigger and function
DROP TRIGGER IF EXISTS trigger_offer_history ON public.offers;
DROP FUNCTION IF EXISTS create_offer_history_entry();

-- Recreate the function with correct column names
CREATE OR REPLACE FUNCTION create_offer_history_entry()
RETURNS TRIGGER AS $$
DECLARE
  _action text;
  _old_data jsonb;
  _new_data jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _old_data := NULL;
    _new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine action based on status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := 'status_changed_to_' || NEW.status;
    ELSE
      _action := 'updated';
    END IF;
    -- Log changed fields
    _old_data := jsonb_build_object(
      'status', OLD.status,
      'total_net', OLD.total_net,
      'total_gross', OLD.total_gross
    );
    _new_data := jsonb_build_object(
      'status', NEW.status,
      'total_net', NEW.total_net,
      'total_gross', NEW.total_gross
    );
  END IF;

  INSERT INTO public.offer_history (offer_id, action, created_by, old_data, new_data)
  VALUES (
    NEW.id,
    _action,
    auth.uid(),
    _old_data,
    _new_data
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER trigger_offer_history
AFTER INSERT OR UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION create_offer_history_entry();