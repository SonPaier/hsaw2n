-- Fix search_path for generate_public_api_key function
CREATE OR REPLACE FUNCTION generate_public_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_api_key IS NULL THEN
    NEW.public_api_key := encode(gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;