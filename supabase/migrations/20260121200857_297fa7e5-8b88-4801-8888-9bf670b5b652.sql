-- Add source column to offer_scopes (like products_library)
ALTER TABLE offer_scopes 
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'instance';

-- Add comment explaining the column
COMMENT ON COLUMN offer_scopes.source IS 'Source of the scope: global (super admin templates) or instance (local templates)';

-- Create a function to copy global scopes to a new instance
CREATE OR REPLACE FUNCTION public.copy_global_scopes_to_instance(_instance_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scope RECORD;
  v_new_scope_id uuid;
  v_product RECORD;
  v_count integer := 0;
BEGIN
  -- Check if instance already has any scopes
  IF EXISTS (SELECT 1 FROM offer_scopes WHERE instance_id = _instance_id AND active = true) THEN
    -- Instance already has scopes, don't copy
    RETURN 0;
  END IF;
  
  -- Copy all global scopes
  FOR v_scope IN 
    SELECT * FROM offer_scopes 
    WHERE source = 'global' 
    AND instance_id IS NULL 
    AND active = true
    ORDER BY sort_order
  LOOP
    -- Insert the scope copy
    INSERT INTO offer_scopes (
      instance_id, name, short_name, description, 
      is_extras_scope, has_coating_upsell, sort_order,
      default_warranty, default_payment_terms, default_notes, default_service_info,
      source, active
    ) VALUES (
      _instance_id, v_scope.name, v_scope.short_name, v_scope.description,
      v_scope.is_extras_scope, v_scope.has_coating_upsell, v_scope.sort_order,
      v_scope.default_warranty, v_scope.default_payment_terms, v_scope.default_notes, v_scope.default_service_info,
      'instance', true
    )
    RETURNING id INTO v_new_scope_id;
    
    -- Copy products for this scope
    FOR v_product IN
      SELECT * FROM offer_scope_products
      WHERE scope_id = v_scope.id
      ORDER BY sort_order
    LOOP
      INSERT INTO offer_scope_products (
        scope_id, product_id, variant_name, is_default, sort_order, instance_id
      ) VALUES (
        v_new_scope_id, v_product.product_id, v_product.variant_name, 
        v_product.is_default, v_product.sort_order, _instance_id
      );
    END LOOP;
    
    v_count := v_count + 1;
  END LOOP;
  
  -- If no global extras scope was copied, create a default one
  IF NOT EXISTS (
    SELECT 1 FROM offer_scopes 
    WHERE instance_id = _instance_id AND is_extras_scope = true AND active = true
  ) THEN
    INSERT INTO offer_scopes (
      instance_id, name, short_name, is_extras_scope, source, active, sort_order
    ) VALUES (
      _instance_id, 'Dodatki', 'Dodatki', true, 'instance', true, 999
    );
    v_count := v_count + 1;
  END IF;
  
  RETURN v_count;
END;
$$;