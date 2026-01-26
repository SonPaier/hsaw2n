-- Add notes column to vehicle_protocols table
ALTER TABLE public.vehicle_protocols 
ADD COLUMN notes TEXT DEFAULT NULL;