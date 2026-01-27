-- Drop the old unique constraint
ALTER TABLE customer_reminders 
DROP CONSTRAINT customer_reminders_instance_id_customer_phone_vehicle_plate_key;

-- Create new unique constraint that includes months_after
ALTER TABLE customer_reminders 
ADD CONSTRAINT customer_reminders_unique_per_schedule 
UNIQUE (instance_id, customer_phone, vehicle_plate, reminder_template_id, months_after);

-- Update the function to use the new constraint in ON CONFLICT
CREATE OR REPLACE FUNCTION create_reservation_reminders(p_reservation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_service_id UUID;
  v_service RECORD;
  v_item RECORD;
  v_count INTEGER := 0;
  v_completed_date DATE;
BEGIN
  -- Get reservation
  SELECT * INTO v_reservation 
  FROM reservations 
  WHERE id = p_reservation_id;
  
  IF v_reservation IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Use completed_at if available, otherwise current date
  v_completed_date := COALESCE(v_reservation.completed_at::date, CURRENT_DATE);
  
  -- Iterate over services from reservation (service_ids JSONB array)
  FOR v_service_id IN 
    SELECT jsonb_array_elements_text(COALESCE(v_reservation.service_ids, '[]'::jsonb))::UUID
  LOOP
    -- Get service with reminder template
    SELECT us.*, rt.id as template_id, rt.items as template_items
    INTO v_service
    FROM unified_services us
    LEFT JOIN reminder_templates rt ON us.reminder_template_id = rt.id
    WHERE us.id = v_service_id;
    
    IF v_service.template_id IS NOT NULL AND v_service.template_items IS NOT NULL THEN
      -- Iterate over template items
      FOR v_item IN 
        SELECT * FROM jsonb_to_recordset(v_service.template_items) 
        AS x(months INTEGER, service_type TEXT)
      LOOP
        -- Insert reminder (ON CONFLICT = skip duplicate including months_after)
        INSERT INTO customer_reminders (
          instance_id, 
          reminder_template_id, 
          reservation_id,
          customer_name, 
          customer_phone, 
          vehicle_plate,
          scheduled_date, 
          months_after, 
          service_type
        ) VALUES (
          v_reservation.instance_id,
          v_service.template_id,
          p_reservation_id,
          COALESCE(v_reservation.customer_name, 'Klient'),
          v_reservation.customer_phone,
          COALESCE(v_reservation.vehicle_plate, ''),
          (v_completed_date + (v_item.months * INTERVAL '1 month'))::date,
          v_item.months,
          COALESCE(v_item.service_type, 'serwis')
        )
        ON CONFLICT (instance_id, customer_phone, vehicle_plate, reminder_template_id, months_after) 
        DO NOTHING;
        
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;