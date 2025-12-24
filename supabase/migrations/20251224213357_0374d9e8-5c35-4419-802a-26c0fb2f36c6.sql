-- Allow admins to update ONLY working hours via a secure backend function

CREATE OR REPLACE FUNCTION public.update_instance_working_hours(
  _instance_id uuid,
  _working_hours jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_instance_role(auth.uid(), 'admin'::app_role, _instance_id)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.instances
  SET working_hours = _working_hours,
      updated_at = now()
  WHERE id = _instance_id
  RETURNING working_hours INTO _result;

  IF _result IS NULL THEN
    RAISE EXCEPTION 'instance not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_instance_working_hours(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_instance_working_hours(uuid, jsonb) TO authenticated;
