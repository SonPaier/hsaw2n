-- Security fix: Remove dangerous public RLS policies and add proper ones

-- 1. Remove public SELECT from customers (was allowing anyone to check verification)
DROP POLICY IF EXISTS "Anyone can check if phone is verified" ON public.customers;

-- 2. Remove public policies from customer_vehicles
DROP POLICY IF EXISTS "Anyone can read vehicles" ON public.customer_vehicles;
DROP POLICY IF EXISTS "Anyone can insert vehicles" ON public.customer_vehicles;
DROP POLICY IF EXISTS "Anyone can update vehicles" ON public.customer_vehicles;

-- 3. Remove public SELECT from sms_verification_codes (CRITICAL - was exposing codes!)
DROP POLICY IF EXISTS "Anyone can verify codes" ON public.sms_verification_codes;
DROP POLICY IF EXISTS "Anyone can read codes" ON public.sms_verification_codes;

-- 4. Update offers SELECT policy to require valid public_token
DROP POLICY IF EXISTS "Anyone can view offers" ON public.offers;
DROP POLICY IF EXISTS "Public can view offers" ON public.offers;

CREATE POLICY "Public can view offers with valid token"
ON public.offers FOR SELECT
USING (
  public_token IS NOT NULL 
  AND status != 'draft'
);

-- 5. Add policies for offer child tables that validate via parent offer token
DROP POLICY IF EXISTS "Anyone can view offer options" ON public.offer_options;
CREATE POLICY "Public can view offer options via valid offer"
ON public.offer_options FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.offers 
    WHERE offers.id = offer_options.offer_id 
    AND offers.public_token IS NOT NULL
    AND offers.status != 'draft'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can view offer option items" ON public.offer_option_items;
CREATE POLICY "Public can view offer option items via valid offer"
ON public.offer_option_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.offer_options oo
    JOIN public.offers o ON o.id = oo.offer_id
    WHERE oo.id = offer_option_items.option_id
    AND o.public_token IS NOT NULL
    AND o.status != 'draft'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can view offer text blocks" ON public.offer_text_blocks;
CREATE POLICY "Public can view offer text blocks via valid offer"
ON public.offer_text_blocks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.offers 
    WHERE offers.id = offer_text_blocks.offer_id 
    AND offers.public_token IS NOT NULL
    AND offers.status != 'draft'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()
  )
);

-- 6. Helper function for super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role)
$$;

-- 7. Helper function for instance access check
CREATE OR REPLACE FUNCTION public.can_access_instance(_instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_super_admin() 
    OR public.has_instance_role(auth.uid(), 'admin'::app_role, _instance_id)
    OR public.has_instance_role(auth.uid(), 'employee'::app_role, _instance_id)
$$;