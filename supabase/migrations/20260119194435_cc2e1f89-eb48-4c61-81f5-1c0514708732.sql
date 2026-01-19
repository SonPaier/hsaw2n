-- Funkcja generująca unikalny 8-znakowy token dla protokołów
CREATE OR REPLACE FUNCTION public.generate_protocol_token()
RETURNS TEXT AS $$
DECLARE
  _token TEXT;
  _attempts INT := 0;
BEGIN
  LOOP
    _token := LEFT(gen_random_uuid()::TEXT, 8);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.vehicle_protocols WHERE public_token = _token
    );
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique protocol token';
    END IF;
  END LOOP;
  RETURN _token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Dodaj public_token do vehicle_protocols
ALTER TABLE public.vehicle_protocols 
ADD COLUMN public_token TEXT;

-- Dodaj customer_email do vehicle_protocols
ALTER TABLE public.vehicle_protocols 
ADD COLUMN customer_email TEXT;

-- Wygeneruj tokeny dla istniejących protokołów
UPDATE public.vehicle_protocols 
SET public_token = public.generate_protocol_token() 
WHERE public_token IS NULL;

-- Ustaw NOT NULL i UNIQUE
ALTER TABLE public.vehicle_protocols 
ALTER COLUMN public_token SET NOT NULL;

ALTER TABLE public.vehicle_protocols 
ADD CONSTRAINT vehicle_protocols_public_token_unique UNIQUE (public_token);

-- Dodaj photo_urls (tablica) do protocol_damage_points
ALTER TABLE public.protocol_damage_points 
ADD COLUMN photo_urls TEXT[];

-- Polityka RLS dla publicznego dostępu do protokołów (tylko SELECT)
CREATE POLICY "Public read access to protocols via token" ON public.vehicle_protocols
FOR SELECT
USING (true);

-- Polityka RLS dla publicznego dostępu do punktów uszkodzeń
CREATE POLICY "Public read access to damage points" ON public.protocol_damage_points
FOR SELECT
USING (true);