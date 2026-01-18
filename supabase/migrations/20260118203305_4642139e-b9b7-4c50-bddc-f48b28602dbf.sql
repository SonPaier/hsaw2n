
-- Fix search_path for check_station_limit function
CREATE OR REPLACE FUNCTION check_station_limit()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM stations
  WHERE instance_id = NEW.instance_id;

  SELECT COALESCE(station_limit, 2) INTO max_allowed
  FROM instance_subscriptions
  WHERE instance_id = NEW.instance_id;

  IF max_allowed IS NULL THEN
    max_allowed := 2;
  END IF;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limit stanowisk osiągnięty (% z %)', current_count, max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
