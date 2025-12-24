-- Create table for SMS verification codes
CREATE TABLE public.sms_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  reservation_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_verification_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can create verification codes (public booking)
CREATE POLICY "Anyone can create verification codes"
ON public.sms_verification_codes
FOR INSERT
WITH CHECK (true);

-- Anyone can read their verification code by phone
CREATE POLICY "Anyone can read verification by phone"
ON public.sms_verification_codes
FOR SELECT
USING (true);

-- Anyone can update verification status
CREATE POLICY "Anyone can update verification status"
ON public.sms_verification_codes
FOR UPDATE
USING (true);

-- Index for faster lookups
CREATE INDEX idx_sms_verification_phone ON public.sms_verification_codes(phone, code);
CREATE INDEX idx_sms_verification_expires ON public.sms_verification_codes(expires_at);