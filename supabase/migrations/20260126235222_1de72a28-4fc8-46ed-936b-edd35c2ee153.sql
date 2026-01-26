-- 1. Create customer_reminders table (replaces offer_reminders)
CREATE TABLE IF NOT EXISTS customer_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  reminder_template_id UUID NOT NULL REFERENCES reminder_templates(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  
  -- Denormalized customer data for fast display
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL DEFAULT '',
  
  -- Schedule
  scheduled_date DATE NOT NULL,
  months_after INTEGER NOT NULL,
  service_type TEXT NOT NULL,
  
  -- Status: scheduled/sent/failed/cancelled
  status TEXT NOT NULL DEFAULT 'scheduled',
  sent_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique: customer + vehicle + template (prevents duplicates)
  UNIQUE(instance_id, customer_phone, vehicle_plate, reminder_template_id)
);

-- 2. Enable RLS
ALTER TABLE customer_reminders ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy
CREATE POLICY "Users can manage customer reminders for their instance"
ON customer_reminders FOR ALL
TO authenticated
USING (can_access_instance(instance_id))
WITH CHECK (can_access_instance(instance_id));

-- 4. Trigger for updated_at
CREATE TRIGGER update_customer_reminders_updated_at
  BEFORE UPDATE ON customer_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Function to create reminders when reservation is completed
CREATE OR REPLACE FUNCTION create_reservation_reminders(p_reservation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
        -- Insert reminder (ON CONFLICT = skip duplicate)
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
        ON CONFLICT (instance_id, customer_phone, vehicle_plate, reminder_template_id) 
        DO NOTHING;
        
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- 6. Trigger function for reservation completed
CREATE OR REPLACE FUNCTION handle_reservation_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM create_reservation_reminders(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Create trigger on reservations
CREATE TRIGGER on_reservation_completed
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION handle_reservation_completed();

-- 8. Index for faster queries
CREATE INDEX idx_customer_reminders_instance_status ON customer_reminders(instance_id, status);
CREATE INDEX idx_customer_reminders_scheduled_date ON customer_reminders(scheduled_date);
CREATE INDEX idx_customer_reminders_phone ON customer_reminders(customer_phone);