-- Create default "Ogólne" category for instances that have services without categories
INSERT INTO service_categories (instance_id, name, slug, sort_order, active)
SELECT DISTINCT s.instance_id, 'Ogólne', 'ogolne', 0, true
FROM services s
WHERE s.category_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM service_categories sc 
  WHERE sc.instance_id = s.instance_id AND sc.slug = 'ogolne'
)
ON CONFLICT DO NOTHING;

-- Assign services without category to the first available category for their instance
UPDATE services s
SET category_id = (
  SELECT sc.id FROM service_categories sc 
  WHERE sc.instance_id = s.instance_id 
  AND sc.active = true
  ORDER BY sc.sort_order 
  LIMIT 1
)
WHERE s.category_id IS NULL;

-- Now make category_id NOT NULL
ALTER TABLE services ALTER COLUMN category_id SET NOT NULL;