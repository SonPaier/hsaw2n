-- Allow public access to products_library description when accessed through offer_option_items
-- This enables the public offer view to display product descriptions
CREATE POLICY "Public can read products via offer items"
ON products_library
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM offer_option_items ooi
    WHERE ooi.product_id = products_library.id
  )
);