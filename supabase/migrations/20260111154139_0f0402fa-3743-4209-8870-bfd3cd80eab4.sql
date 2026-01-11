-- Fix create_offer_reminders function to use customer_data JSON instead of customer_id
CREATE OR REPLACE FUNCTION public.create_offer_reminders(
  p_offer_id UUID,
  p_completed_at TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer RECORD;
  v_product RECORD;
  v_template RECORD;
  v_reminder RECORD;
  v_count INTEGER := 0;
  v_scheduled_date DATE;
  v_processed_products UUID[] := ARRAY[]::UUID[];
  v_selected_state JSONB;
  v_selected_option_ids UUID[] := ARRAY[]::UUID[];
  v_variant_id TEXT;
  v_upsell_id TEXT;
  v_selected_item_id UUID;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_sms_template TEXT;
BEGIN
  -- Get offer details including selected_state and customer_data
  SELECT o.id, o.instance_id, o.selected_state, o.customer_data
  INTO v_offer
  FROM offers o
  WHERE o.id = p_offer_id;
  
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;
  
  v_selected_state := v_offer.selected_state;
  
  -- Extract customer data from JSON
  v_customer_name := COALESCE(v_offer.customer_data->>'name', 'Klient');
  v_customer_phone := COALESCE(v_offer.customer_data->>'phone', '');
  
  -- Extract selected option IDs from selected_state
  IF v_selected_state IS NOT NULL THEN
    -- Get variant selections (scope_id -> option_id)
    IF v_selected_state ? 'selectedVariants' AND v_selected_state->'selectedVariants' IS NOT NULL THEN
      FOR v_variant_id IN SELECT jsonb_object_keys(v_selected_state->'selectedVariants')
      LOOP
        IF v_selected_state->'selectedVariants'->>v_variant_id IS NOT NULL THEN
          v_selected_option_ids := array_append(v_selected_option_ids, (v_selected_state->'selectedVariants'->>v_variant_id)::UUID);
        END IF;
      END LOOP;
    END IF;
    
    -- Get upsell selections (option_id -> boolean)
    IF v_selected_state ? 'selectedUpsells' AND v_selected_state->'selectedUpsells' IS NOT NULL THEN
      FOR v_upsell_id IN SELECT jsonb_object_keys(v_selected_state->'selectedUpsells')
      LOOP
        IF (v_selected_state->'selectedUpsells'->>v_upsell_id)::BOOLEAN = true THEN
          v_selected_option_ids := array_append(v_selected_option_ids, v_upsell_id::UUID);
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  -- If no selected_state, fall back to is_selected (for older offers)
  IF array_length(v_selected_option_ids, 1) IS NULL OR array_length(v_selected_option_ids, 1) = 0 THEN
    SELECT array_agg(id) INTO v_selected_option_ids
    FROM offer_options 
    WHERE offer_id = p_offer_id AND is_selected = true;
  END IF;
  
  -- Get products with reminder templates from selected options only
  FOR v_product IN 
    SELECT DISTINCT ON (pl.id)
      ooi.id as item_id,
      ooi.product_id,
      ooi.custom_name,
      oo.id as option_id,
      pl.name as product_name,
      pl.reminder_template_id
    FROM offer_options oo
    JOIN offer_option_items ooi ON ooi.option_id = oo.id
    JOIN products_library pl ON pl.id = ooi.product_id
    WHERE oo.offer_id = p_offer_id 
      AND oo.id = ANY(v_selected_option_ids)
      AND ooi.product_id IS NOT NULL
      AND pl.reminder_template_id IS NOT NULL
  LOOP
    -- Check if item was specifically selected within the option (for options with item selection)
    IF v_selected_state ? 'selectedItemInOption' 
       AND v_selected_state->'selectedItemInOption' ? v_product.option_id::TEXT THEN
      v_selected_item_id := (v_selected_state->'selectedItemInOption'->>v_product.option_id::TEXT)::UUID;
      IF v_selected_item_id IS NOT NULL AND v_selected_item_id != v_product.item_id THEN
        CONTINUE; -- Skip items not selected within the option
      END IF;
    END IF;
    
    -- Skip if we already processed this product
    IF v_product.product_id = ANY(v_processed_products) THEN
      CONTINUE;
    END IF;
    
    v_processed_products := array_append(v_processed_products, v_product.product_id);
    
    -- Get the template
    SELECT rt.id, rt.name, rt.items, rt.sms_template
    INTO v_template
    FROM reminder_templates rt
    WHERE rt.id = v_product.reminder_template_id;
    
    IF v_template.id IS NULL THEN
      CONTINUE;
    END IF;
    
    v_sms_template := COALESCE(v_template.sms_template, '');
    
    -- Create reminders from template items
    FOR v_reminder IN 
      SELECT * FROM jsonb_to_recordset(v_template.items) 
      AS x(months INT, is_paid BOOLEAN, service_type TEXT)
    LOOP
      v_scheduled_date := (p_completed_at + (v_reminder.months * INTERVAL '1 month'))::DATE;
      
      INSERT INTO offer_reminders (
        offer_id,
        instance_id,
        customer_name,
        customer_phone,
        product_id,
        service_name,
        scheduled_date,
        months_after,
        is_paid,
        service_type,
        sms_template,
        status
      ) VALUES (
        p_offer_id,
        v_offer.instance_id,
        v_customer_name,
        v_customer_phone,
        v_product.product_id,
        COALESCE(v_product.custom_name, v_product.product_name),
        v_scheduled_date,
        v_reminder.months,
        COALESCE(v_reminder.is_paid, false),
        COALESCE(v_reminder.service_type, 'inspection'),
        v_sms_template,
        'scheduled'
      );
      
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$;