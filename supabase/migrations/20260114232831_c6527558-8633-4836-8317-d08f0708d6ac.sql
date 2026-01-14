-- Add protocol_time column to vehicle_protocols
ALTER TABLE public.vehicle_protocols
ADD COLUMN protocol_time TIME DEFAULT NULL;