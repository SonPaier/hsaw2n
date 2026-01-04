-- Add car_size column to customer_vehicles table
ALTER TABLE public.customer_vehicles ADD COLUMN IF NOT EXISTS car_size text;

-- Update the upsert function to include car_size
CREATE OR REPLACE FUNCTION public.upsert_customer_vehicle(_instance_id uuid, _phone text, _model text, _plate text DEFAULT NULL::text, _customer_id uuid DEFAULT NULL::uuid, _car_size text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _vehicle_id UUID;
BEGIN
  INSERT INTO public.customer_vehicles (instance_id, phone, model, plate, customer_id, car_size, usage_count, last_used_at)
  VALUES (_instance_id, _phone, _model, _plate, _customer_id, _car_size, 1, now())
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