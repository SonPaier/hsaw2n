-- Fix search_path for the new function
CREATE OR REPLACE FUNCTION public.generate_short_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _token TEXT;
  _attempts INT := 0;
BEGIN
  LOOP
    _token := LEFT(gen_random_uuid()::TEXT, 8);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.offers WHERE public_token = _token
    );
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique token';
    END IF;
  END LOOP;
  RETURN _token;
END;
$$;