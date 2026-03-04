ALTER TABLE public.instances ADD COLUMN sms_sender_name TEXT DEFAULT NULL;

UPDATE public.instances SET sms_sender_name = 'Arm Car' WHERE slug = 'armcar';