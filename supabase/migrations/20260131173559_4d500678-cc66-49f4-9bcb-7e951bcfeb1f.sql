-- Fix broken RLS policies for offer-related tables that try to filter by non-existent instance_id column
-- These tables use offer_id which has a foreign key to offers table that has instance_id

-- 1. Drop existing broken policies for offer_text_blocks
DROP POLICY IF EXISTS "offer_text_blocks_admin_access" ON offer_text_blocks;
DROP POLICY IF EXISTS "offer_text_blocks_view" ON offer_text_blocks;
DROP POLICY IF EXISTS "offer_text_blocks_manage" ON offer_text_blocks;

-- 2. Drop existing broken policies for offer_options
DROP POLICY IF EXISTS "offer_options_admin_access" ON offer_options;
DROP POLICY IF EXISTS "offer_options_view" ON offer_options;
DROP POLICY IF EXISTS "offer_options_manage" ON offer_options;

-- 3. Drop existing broken policies for offer_option_items
DROP POLICY IF EXISTS "offer_option_items_admin_access" ON offer_option_items;
DROP POLICY IF EXISTS "offer_option_items_view" ON offer_option_items;
DROP POLICY IF EXISTS "offer_option_items_manage" ON offer_option_items;

-- 4. Drop existing broken policies for offer_history
DROP POLICY IF EXISTS "offer_history_admin_access" ON offer_history;
DROP POLICY IF EXISTS "offer_history_view" ON offer_history;
DROP POLICY IF EXISTS "offer_history_manage" ON offer_history;

-- Create helper function to get offer's instance_id
CREATE OR REPLACE FUNCTION public.get_offer_instance_id(p_offer_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT instance_id FROM offers WHERE id = p_offer_id
$$;

-- Create fixed RLS policies using the helper function

-- offer_text_blocks policies
CREATE POLICY "offer_text_blocks_select" ON offer_text_blocks
FOR SELECT USING (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_text_blocks_insert" ON offer_text_blocks
FOR INSERT WITH CHECK (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_text_blocks_update" ON offer_text_blocks
FOR UPDATE USING (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_text_blocks_delete" ON offer_text_blocks
FOR DELETE USING (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- offer_options policies
CREATE POLICY "offer_options_select" ON offer_options
FOR SELECT USING (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_options_insert" ON offer_options
FOR INSERT WITH CHECK (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_options_update" ON offer_options
FOR UPDATE USING (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_options_delete" ON offer_options
FOR DELETE USING (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- offer_option_items policies (uses option_id -> offer_options -> offers)
CREATE OR REPLACE FUNCTION public.get_option_instance_id(p_option_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.instance_id 
  FROM offers o
  JOIN offer_options oo ON oo.offer_id = o.id
  WHERE oo.id = p_option_id
$$;

CREATE POLICY "offer_option_items_select" ON offer_option_items
FOR SELECT USING (
  public.get_option_instance_id(option_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_option_items_insert" ON offer_option_items
FOR INSERT WITH CHECK (
  public.get_option_instance_id(option_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_option_items_update" ON offer_option_items
FOR UPDATE USING (
  public.get_option_instance_id(option_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_option_items_delete" ON offer_option_items
FOR DELETE USING (
  public.get_option_instance_id(option_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- offer_history policies
CREATE POLICY "offer_history_select" ON offer_history
FOR SELECT USING (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "offer_history_insert" ON offer_history
FOR INSERT WITH CHECK (
  public.get_offer_instance_id(offer_id) IN (
    SELECT instance_id FROM user_roles WHERE user_id = auth.uid() AND instance_id IS NOT NULL
  )
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- Add performance indexes for frequent queries (without CONCURRENTLY for transaction compatibility)
CREATE INDEX IF NOT EXISTS idx_reservations_instance_date 
  ON reservations(instance_id, reservation_date);

CREATE INDEX IF NOT EXISTS idx_reservations_instance_status 
  ON reservations(instance_id, status);

CREATE INDEX IF NOT EXISTS idx_offers_instance_status 
  ON offers(instance_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_vehicles_instance_phone 
  ON customer_vehicles(instance_id, phone);

CREATE INDEX IF NOT EXISTS idx_notifications_instance_unread 
  ON notifications(instance_id, read) WHERE read = false;