-- Add protocol_type column to vehicle_protocols
-- 'reception' = przyjęcia, 'pickup' = odbioru
ALTER TABLE public.vehicle_protocols
ADD COLUMN protocol_type text NOT NULL DEFAULT 'reception';