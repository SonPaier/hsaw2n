-- Create table for SMS message type settings per instance
CREATE TABLE public.sms_message_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(instance_id, message_type)
);

-- Enable RLS
ALTER TABLE public.sms_message_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage SMS settings"
  ON public.sms_message_settings
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "SMS settings viewable by admins"
  ON public.sms_message_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sms_message_settings_updated_at
  BEFORE UPDATE ON public.sms_message_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();