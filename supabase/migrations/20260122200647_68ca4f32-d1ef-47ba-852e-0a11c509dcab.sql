-- Add timezone column to instances table for SMS reminder calculations
ALTER TABLE public.instances 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Warsaw';

COMMENT ON COLUMN public.instances.timezone IS 
'Strefa czasowa instancji dla obliczeń przypomnień SMS (np. Europe/Warsaw)';