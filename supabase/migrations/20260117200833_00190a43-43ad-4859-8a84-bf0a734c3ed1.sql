
-- Migration: Copy offer-related data from ARMCAR to DEMO instance
-- ARMCAR: 4ce15650-76c7-47e7-b5c8-32b9a2d1c321
-- DEMO: b3c29bfe-f393-4e1a-a837-68dd721df420

-- Step 1: Copy reminder_templates with new UUIDs
WITH reminder_mapping AS (
  SELECT 
    id AS old_id,
    gen_random_uuid() AS new_id,
    'b3c29bfe-f393-4e1a-a837-68dd721df420'::uuid AS new_instance_id
  FROM reminder_templates 
  WHERE instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
),
inserted_reminders AS (
  INSERT INTO reminder_templates (id, instance_id, name, description, sms_template, items, created_at, updated_at)
  SELECT 
    rm.new_id,
    rm.new_instance_id,
    rt.name,
    rt.description,
    rt.sms_template,
    rt.items,
    now(),
    now()
  FROM reminder_templates rt
  JOIN reminder_mapping rm ON rt.id = rm.old_id
  ON CONFLICT DO NOTHING
  RETURNING id
)
SELECT 'reminder_templates copied' AS step;

-- Step 2: Copy products_library with new UUIDs and mapped reminder_template_id
WITH reminder_mapping AS (
  SELECT 
    old_rt.id AS old_id,
    new_rt.id AS new_id
  FROM reminder_templates old_rt
  JOIN reminder_templates new_rt 
    ON old_rt.name = new_rt.name 
    AND old_rt.instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
    AND new_rt.instance_id = 'b3c29bfe-f393-4e1a-a837-68dd721df420'
),
product_mapping AS (
  SELECT 
    id AS old_id,
    gen_random_uuid() AS new_id,
    'b3c29bfe-f393-4e1a-a837-68dd721df420'::uuid AS new_instance_id
  FROM products_library 
  WHERE instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
)
INSERT INTO products_library (
  id, instance_id, name, short_name, description, category, brand, 
  default_price, unit, source, active, sort_order, 
  reminder_template_id, default_validity_days, default_payment_terms, 
  default_warranty_terms, default_service_info, metadata, created_at, updated_at
)
SELECT 
  pm.new_id,
  pm.new_instance_id,
  pl.name,
  pl.short_name,
  pl.description,
  pl.category,
  pl.brand,
  pl.default_price,
  pl.unit,
  pl.source,
  pl.active,
  pl.sort_order,
  rm.new_id, -- mapped reminder_template_id
  pl.default_validity_days,
  pl.default_payment_terms,
  pl.default_warranty_terms,
  pl.default_service_info,
  pl.metadata,
  now(),
  now()
FROM products_library pl
JOIN product_mapping pm ON pl.id = pm.old_id
LEFT JOIN reminder_mapping rm ON pl.reminder_template_id = rm.old_id
ON CONFLICT DO NOTHING;

-- Step 3: Copy offer_scopes with new UUIDs
WITH scope_mapping AS (
  SELECT 
    id AS old_id,
    gen_random_uuid() AS new_id,
    'b3c29bfe-f393-4e1a-a837-68dd721df420'::uuid AS new_instance_id
  FROM offer_scopes 
  WHERE instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
)
INSERT INTO offer_scopes (
  id, instance_id, name, short_name, description, active, sort_order,
  has_coating_upsell, is_extras_scope, default_warranty, default_payment_terms,
  default_notes, default_service_info, created_at, updated_at
)
SELECT 
  sm.new_id,
  sm.new_instance_id,
  os.name,
  os.short_name,
  os.description,
  os.active,
  os.sort_order,
  os.has_coating_upsell,
  os.is_extras_scope,
  os.default_warranty,
  os.default_payment_terms,
  os.default_notes,
  os.default_service_info,
  now(),
  now()
FROM offer_scopes os
JOIN scope_mapping sm ON os.id = sm.old_id
ON CONFLICT DO NOTHING;

-- Step 4: Copy offer_scope_products with mapped scope_id and product_id
WITH scope_mapping AS (
  SELECT 
    old_os.id AS old_id,
    new_os.id AS new_id
  FROM offer_scopes old_os
  JOIN offer_scopes new_os 
    ON old_os.name = new_os.name 
    AND old_os.instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
    AND new_os.instance_id = 'b3c29bfe-f393-4e1a-a837-68dd721df420'
),
product_mapping AS (
  SELECT 
    old_pl.id AS old_id,
    new_pl.id AS new_id
  FROM products_library old_pl
  JOIN products_library new_pl 
    ON old_pl.name = new_pl.name 
    AND old_pl.instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
    AND new_pl.instance_id = 'b3c29bfe-f393-4e1a-a837-68dd721df420'
)
INSERT INTO offer_scope_products (
  id, instance_id, scope_id, product_id, variant_name, is_default, sort_order, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  'b3c29bfe-f393-4e1a-a837-68dd721df420'::uuid,
  sm.new_id, -- mapped scope_id
  pm.new_id, -- mapped product_id
  osp.variant_name,
  osp.is_default,
  osp.sort_order,
  now(),
  now()
FROM offer_scope_products osp
JOIN scope_mapping sm ON osp.scope_id = sm.old_id
JOIN product_mapping pm ON osp.product_id = pm.old_id
WHERE osp.instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
ON CONFLICT DO NOTHING;
