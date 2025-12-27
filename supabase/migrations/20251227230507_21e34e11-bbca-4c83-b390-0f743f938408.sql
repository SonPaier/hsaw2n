-- Add Google Maps link field to instances
ALTER TABLE public.instances
ADD COLUMN google_maps_url text;