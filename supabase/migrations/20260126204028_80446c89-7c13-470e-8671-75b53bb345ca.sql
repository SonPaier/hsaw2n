CREATE OR REPLACE FUNCTION public.generate_offer_number(_instance_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _month TEXT;
  _day TEXT;
  _count INTEGER;
  _prefix TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  _month := to_char(now(), 'MM');
  _day := to_char(now(), 'DD');
  
  -- Zlicz WSZYSTKIE oferty dla instancji (bez filtrowania po dacie)
  -- Używamy MAX z parsowaniem ostatniego segmentu numeru
  SELECT COALESCE(MAX(
    CASE 
      WHEN offer_number ~ '/[0-9]+$' 
      THEN (regexp_replace(offer_number, '.*/([0-9]+)$', '\1'))::INTEGER 
      ELSE 0 
    END
  ), 0) + 1 INTO _count
  FROM public.offers
  WHERE instance_id = _instance_id;
  
  -- Pobierz prefix z slug instancji
  SELECT UPPER(LEFT(slug, 3)) INTO _prefix
  FROM public.instances
  WHERE id = _instance_id;
  
  -- Nowy format: PREFIX/DD/MM/YYYY/NUMER
  RETURN COALESCE(_prefix, 'OFF') || '/' || _day || '/' || _month || '/' || _year || '/' || _count::TEXT;
END;
$$;