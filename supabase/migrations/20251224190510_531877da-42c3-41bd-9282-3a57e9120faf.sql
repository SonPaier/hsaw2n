-- Add background_color column to instances table
ALTER TABLE public.instances 
ADD COLUMN background_color TEXT DEFAULT '#ffffff';