-- ============================================
-- FAZA 3: Dodanie Foreign Keys do unified_services
-- ============================================

-- 3.1 FK dla reservations.service_id -> unified_services
-- (nie dodajemy constraint na service_id bo to legacy, ale możemy dodać indeks)
CREATE INDEX IF NOT EXISTS idx_reservations_service_id ON public.reservations(service_id);

-- 3.2 FK dla offer_option_items.product_id -> unified_services
-- Najpierw drop starego FK jeśli istnieje
ALTER TABLE public.offer_option_items 
  DROP CONSTRAINT IF EXISTS offer_option_items_product_id_fkey;

-- Dodaj nowy FK do unified_services
ALTER TABLE public.offer_option_items
  ADD CONSTRAINT offer_option_items_unified_service_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.unified_services(id) 
  ON DELETE SET NULL;

-- 3.3 FK dla offer_scope_products.product_id -> unified_services  
ALTER TABLE public.offer_scope_products 
  DROP CONSTRAINT IF EXISTS offer_scope_products_product_id_fkey;

ALTER TABLE public.offer_scope_products
  ADD CONSTRAINT offer_scope_products_unified_service_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.unified_services(id) 
  ON DELETE CASCADE;

-- 3.4 FK dla offer_reminders.product_id -> unified_services
ALTER TABLE public.offer_reminders 
  DROP CONSTRAINT IF EXISTS offer_reminders_product_id_fkey;

ALTER TABLE public.offer_reminders
  ADD CONSTRAINT offer_reminders_unified_service_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.unified_services(id) 
  ON DELETE SET NULL;

-- 3.5 FK dla offer_scope_variant_products.product_id -> unified_services
ALTER TABLE public.offer_scope_variant_products 
  DROP CONSTRAINT IF EXISTS offer_scope_variant_products_product_id_fkey;

ALTER TABLE public.offer_scope_variant_products
  ADD CONSTRAINT offer_scope_variant_products_unified_service_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.unified_services(id) 
  ON DELETE SET NULL;

-- 3.6 FK dla offer_scope_extra_products.product_id -> unified_services
ALTER TABLE public.offer_scope_extra_products 
  DROP CONSTRAINT IF EXISTS offer_scope_extra_products_product_id_fkey;

ALTER TABLE public.offer_scope_extra_products
  ADD CONSTRAINT offer_scope_extra_products_unified_service_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.unified_services(id) 
  ON DELETE SET NULL;