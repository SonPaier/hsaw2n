-- Add booking_days_ahead setting to instances table
ALTER TABLE public.instances 
ADD COLUMN booking_days_ahead integer NOT NULL DEFAULT 90;