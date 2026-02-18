
CREATE OR REPLACE FUNCTION public.generate_public_api_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.public_api_key IS NULL THEN
    NEW.public_api_key := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$function$;
