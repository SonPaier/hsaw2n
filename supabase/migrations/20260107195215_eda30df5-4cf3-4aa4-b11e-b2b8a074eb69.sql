-- Add reservation phone column to instances table
ALTER TABLE public.instances
ADD COLUMN reservation_phone text;