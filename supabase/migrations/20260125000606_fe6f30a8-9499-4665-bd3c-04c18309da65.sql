-- Add visibility column to unified_services
-- This separates UI visibility control from the data model type (service_type)
ALTER TABLE unified_services 
ADD COLUMN visibility TEXT DEFAULT 'all' 
CHECK (visibility IN ('all', 'reservations', 'offers'));

-- Migrate existing data: copy service_type values to visibility for legacy services
UPDATE unified_services 
SET visibility = CASE 
  WHEN service_type = 'reservation' THEN 'reservations'
  WHEN service_type = 'offer' THEN 'offers'
  ELSE 'all'
END;

-- Add comment for clarity
COMMENT ON COLUMN unified_services.visibility IS 'UI visibility in drawers: all, reservations, offers. Independent of service_type which defines data model.';