-- Step 1: Drop ALL RLS policies that depend on public_token (including on offers table)
DROP POLICY IF EXISTS "Public can view offer options via valid offer" ON public.offer_options;
DROP POLICY IF EXISTS "Public can view offer option items via valid offer" ON public.offer_option_items;
DROP POLICY IF EXISTS "Public can view offer text blocks via valid offer" ON public.offer_text_blocks;
DROP POLICY IF EXISTS "Public view offers with token" ON public.offers;
DROP POLICY IF EXISTS "Public can view offers" ON public.offers;
DROP POLICY IF EXISTS "Public update offer via token" ON public.offers;

-- Step 2: Drop index
DROP INDEX IF EXISTS idx_offers_public_token;

-- Step 3: Alter column type to TEXT
ALTER TABLE public.offers 
ALTER COLUMN public_token TYPE TEXT USING public_token::TEXT;

-- Step 4: Update existing tokens to use only first 8 characters
UPDATE public.offers 
SET public_token = LEFT(public_token, 8)
WHERE public_token IS NOT NULL AND LENGTH(public_token) > 8;

-- Step 5: Create function to generate short token
CREATE OR REPLACE FUNCTION public.generate_short_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  _token TEXT;
  _attempts INT := 0;
BEGIN
  LOOP
    _token := LEFT(gen_random_uuid()::TEXT, 8);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.offers WHERE public_token = _token
    );
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique token';
    END IF;
  END LOOP;
  RETURN _token;
END;
$$;

-- Step 6: Set new default
ALTER TABLE public.offers 
ALTER COLUMN public_token SET DEFAULT public.generate_short_token();

-- Step 7: Recreate unique index
CREATE UNIQUE INDEX idx_offers_public_token ON public.offers(public_token);

-- Step 8: Recreate RLS policies for offers
CREATE POLICY "Public view offers with token"
ON public.offers FOR SELECT
USING (
  (public_token IS NOT NULL)
  OR can_access_instance(instance_id)
);

CREATE POLICY "Public update offer via token"
ON public.offers FOR UPDATE
USING (public_token IS NOT NULL)
WITH CHECK (public_token IS NOT NULL);

-- Step 9: Recreate RLS policies for related tables
CREATE POLICY "Public can view offer options via valid offer"
ON public.offer_options FOR SELECT
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

CREATE POLICY "Public can view offer option items via valid offer"
ON public.offer_option_items FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM offer_options oo
    JOIN offers o ON o.id = oo.offer_id
    WHERE oo.id = offer_option_items.option_id
    AND o.public_token IS NOT NULL
  ))
  OR (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
  ))
);

CREATE POLICY "Public can view offer text blocks via valid offer"
ON public.offer_text_blocks FOR SELECT
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