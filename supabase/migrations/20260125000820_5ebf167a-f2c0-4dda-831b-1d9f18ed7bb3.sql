-- First drop the old constraint
ALTER TABLE unified_services 
DROP CONSTRAINT IF EXISTS unified_services_visibility_check;

-- Update visibility values to new naming
UPDATE unified_services 
SET visibility = CASE 
  WHEN visibility = 'all' THEN 'everywhere'
  WHEN visibility = 'reservations' THEN 'only_reservations'
  WHEN visibility = 'offers' THEN 'only_offers'
  ELSE 'everywhere'
END;

-- Add the new check constraint
ALTER TABLE unified_services 
ADD CONSTRAINT unified_services_visibility_check 
CHECK (visibility IN ('everywhere', 'only_reservations', 'only_offers'));

-- Update default value
ALTER TABLE unified_services 
ALTER COLUMN visibility SET DEFAULT 'everywhere';