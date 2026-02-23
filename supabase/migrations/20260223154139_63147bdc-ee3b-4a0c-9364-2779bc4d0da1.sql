
-- Fix upsert_customer_vehicle to normalize phone (strip + prefix) before insert
CREATE OR REPLACE FUNCTION public.upsert_customer_vehicle(
  _instance_id uuid,
  _phone text,
  _model text,
  _plate text DEFAULT NULL::text,
  _customer_id uuid DEFAULT NULL::uuid,
  _car_size text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _vehicle_id UUID;
  _normalized_phone TEXT;
BEGIN
  -- Normalize phone: strip + prefix for consistent storage
  _normalized_phone := regexp_replace(_phone, '^\+', '');
  
  INSERT INTO public.customer_vehicles (instance_id, phone, model, plate, customer_id, car_size, usage_count, last_used_at)
  VALUES (_instance_id, _normalized_phone, _model, _plate, _customer_id, _car_size, 1, now())
  ON CONFLICT (instance_id, phone, model)
  DO UPDATE SET
    usage_count = customer_vehicles.usage_count + 1,
    last_used_at = now(),
    plate = COALESCE(EXCLUDED.plate, customer_vehicles.plate),
    customer_id = COALESCE(EXCLUDED.customer_id, customer_vehicles.customer_id),
    car_size = COALESCE(EXCLUDED.car_size, customer_vehicles.car_size),
    updated_at = now()
  RETURNING id INTO _vehicle_id;
  
  RETURN _vehicle_id;
END;
$function$;

-- Deduplicate existing records: merge +XX duplicates into XX versions
-- First, update usage_count on the "without +" version
UPDATE customer_vehicles cv_keep
SET usage_count = cv_keep.usage_count + cv_dup.usage_count,
    last_used_at = GREATEST(cv_keep.last_used_at, cv_dup.last_used_at),
    plate = COALESCE(cv_keep.plate, cv_dup.plate),
    customer_id = COALESCE(cv_keep.customer_id, cv_dup.customer_id),
    car_size = COALESCE(cv_keep.car_size, cv_dup.car_size),
    updated_at = now()
FROM customer_vehicles cv_dup
WHERE cv_dup.phone = '+' || cv_keep.phone
  AND cv_dup.model = cv_keep.model
  AND cv_dup.instance_id = cv_keep.instance_id;

-- Delete the "+" prefixed duplicates that have a matching non-+ version
DELETE FROM customer_vehicles cv_dup
WHERE cv_dup.phone LIKE '+%'
  AND EXISTS (
    SELECT 1 FROM customer_vehicles cv_keep
    WHERE cv_keep.phone = regexp_replace(cv_dup.phone, '^\+', '')
      AND cv_keep.model = cv_dup.model
      AND cv_keep.instance_id = cv_dup.instance_id
  );

-- Normalize remaining records that still have + prefix
UPDATE customer_vehicles
SET phone = regexp_replace(phone, '^\+', ''),
    updated_at = now()
WHERE phone LIKE '+%';
