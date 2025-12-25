-- Add SMS tracking columns to instances table
ALTER TABLE public.instances
ADD COLUMN IF NOT EXISTS sms_limit integer NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS sms_used integer NOT NULL DEFAULT 0;

-- Create a function to increment SMS usage atomically
CREATE OR REPLACE FUNCTION public.increment_sms_usage(_instance_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_limit integer;
  current_used integer;
BEGIN
  -- Get current values with row lock
  SELECT sms_limit, sms_used INTO current_limit, current_used
  FROM public.instances
  WHERE id = _instance_id
  FOR UPDATE;
  
  -- Check if limit exceeded
  IF current_used >= current_limit THEN
    RETURN false;
  END IF;
  
  -- Increment usage
  UPDATE public.instances
  SET sms_used = sms_used + 1, updated_at = now()
  WHERE id = _instance_id;
  
  RETURN true;
END;
$$;

-- Create a function to check SMS availability (without incrementing)
CREATE OR REPLACE FUNCTION public.check_sms_available(_instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sms_used < sms_limit
  FROM public.instances
  WHERE id = _instance_id;
$$;