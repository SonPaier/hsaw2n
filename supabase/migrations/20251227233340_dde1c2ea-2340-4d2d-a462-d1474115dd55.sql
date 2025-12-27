-- Add shortcut/abbreviation field to services
ALTER TABLE public.services
ADD COLUMN shortcut text DEFAULT NULL;