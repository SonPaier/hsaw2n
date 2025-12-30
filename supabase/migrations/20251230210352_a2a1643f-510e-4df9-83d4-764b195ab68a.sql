-- Add is_popular column to services table
ALTER TABLE public.services ADD COLUMN is_popular boolean DEFAULT false;