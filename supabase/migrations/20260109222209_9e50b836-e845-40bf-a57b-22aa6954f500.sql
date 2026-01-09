-- Fix RLS policies for offer_options - remove status <> 'draft' condition
DROP POLICY IF EXISTS "Public can view offer options via valid offer" ON offer_options;

CREATE POLICY "Public can view offer options via valid offer"
ON offer_options FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM offers
    WHERE offers.id = offer_options.offer_id
    AND offers.public_token IS NOT NULL
  ))
  OR (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
  ))
);

-- Fix RLS policies for offer_option_items - remove status <> 'draft' condition
DROP POLICY IF EXISTS "Public can view offer option items via valid offer" ON offer_option_items;

CREATE POLICY "Public can view offer option items via valid offer"
ON offer_option_items FOR SELECT
USING (
  (EXISTS (
    SELECT 1
    FROM offer_options oo
    JOIN offers o ON o.id = oo.offer_id
    WHERE oo.id = offer_option_items.option_id
    AND o.public_token IS NOT NULL
  ))
  OR (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
  ))
);

-- Fix RLS policies for offer_text_blocks - remove status <> 'draft' condition
DROP POLICY IF EXISTS "Public can view offer text blocks via valid offer" ON offer_text_blocks;

CREATE POLICY "Public can view offer text blocks via valid offer"
ON offer_text_blocks FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM offers
    WHERE offers.id = offer_text_blocks.offer_id
    AND offers.public_token IS NOT NULL
  ))
  OR (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
  ))
);