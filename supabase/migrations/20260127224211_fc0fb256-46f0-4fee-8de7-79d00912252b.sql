-- Dodaj public_api_key do instances (auto-generowany)
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS public_api_key text UNIQUE;

-- Wygeneruj klucze dla istniejących instancji
UPDATE public.instances 
SET public_api_key = encode(gen_random_bytes(12), 'hex')
WHERE public_api_key IS NULL;

-- Trigger: auto-generuj przy INSERT
CREATE OR REPLACE FUNCTION generate_public_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_api_key IS NULL THEN
    NEW.public_api_key := encode(gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_public_api_key ON public.instances;
CREATE TRIGGER trigger_generate_public_api_key
BEFORE INSERT ON public.instances
FOR EACH ROW EXECUTE FUNCTION generate_public_api_key();

-- Dodaj budget_suggestion do offers
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS budget_suggestion numeric;

-- Indeks dla szybkiego lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_public_api_key 
ON public.instances(public_api_key) WHERE public_api_key IS NOT NULL;