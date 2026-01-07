-- Add short_name column for SMS notifications
ALTER TABLE public.instances 
ADD COLUMN short_name text;