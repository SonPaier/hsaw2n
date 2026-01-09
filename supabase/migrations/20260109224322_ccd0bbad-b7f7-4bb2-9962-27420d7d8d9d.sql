-- Fix products_library RLS to allow public access via offer items
-- The current policy is RESTRICTIVE which causes issues

DROP POLICY IF EXISTS "Public can read products via offer items" ON products_library;

CREATE POLICY "Public can read products via offer items"
ON products_library FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM offer_option_items ooi
    WHERE ooi.product_id = products_library.id
  )
);