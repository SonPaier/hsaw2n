-- Add RLS policies for sms_verification_codes
-- This table should only be accessed via edge functions (send-sms-code, verify-sms-code)
-- which use SERVICE_ROLE_KEY, so no direct client access is needed

-- Admin can view for debugging purposes
CREATE POLICY "Admins can view verification codes"
ON public.sms_verification_codes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()
  )
);