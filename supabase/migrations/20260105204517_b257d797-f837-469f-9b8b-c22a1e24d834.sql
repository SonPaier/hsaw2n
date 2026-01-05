-- Tabela do logowania wszystkich wysłanych SMS
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  phone text NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL,
  sent_by uuid NULL,
  reservation_id uuid NULL,
  customer_id uuid NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text NULL,
  smsapi_response jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indeksy dla szybkiego wyszukiwania
CREATE INDEX idx_sms_logs_instance ON public.sms_logs(instance_id);
CREATE INDEX idx_sms_logs_phone ON public.sms_logs(phone);
CREATE INDEX idx_sms_logs_created ON public.sms_logs(created_at DESC);
CREATE INDEX idx_sms_logs_type ON public.sms_logs(message_type);
CREATE INDEX idx_sms_logs_reservation ON public.sms_logs(reservation_id) WHERE reservation_id IS NOT NULL;

-- RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admini mogą przeglądać logi swojej instancji
CREATE POLICY "Admins can view SMS logs" ON public.sms_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  );

-- System może wstawiać logi (edge functions używają service role)
CREATE POLICY "System can insert SMS logs" ON public.sms_logs
  FOR INSERT
  WITH CHECK (true);