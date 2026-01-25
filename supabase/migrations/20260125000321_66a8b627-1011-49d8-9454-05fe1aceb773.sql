-- Fix unified services that had their service_type accidentally changed
-- Restore service_type = 'both' for services in unified categories
UPDATE unified_services us
SET service_type = 'both'
FROM unified_categories uc
WHERE us.category_id = uc.id
  AND uc.category_type = 'both'
  AND us.service_type != 'both';