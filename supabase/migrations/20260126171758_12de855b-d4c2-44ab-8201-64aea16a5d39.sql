-- Add photo_urls column to vehicle_protocols for general protocol photos
ALTER TABLE public.vehicle_protocols
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';