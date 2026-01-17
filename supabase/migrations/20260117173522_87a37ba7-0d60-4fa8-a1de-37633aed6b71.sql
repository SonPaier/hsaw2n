-- 1. Nowa tabela reservation_changes
CREATE TABLE public.reservation_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  instance_id UUID NOT NULL REFERENCES public.instances(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated')),
  field_name TEXT,
  old_value JSONB,
  new_value JSONB NOT NULL,
  batch_id UUID NOT NULL,
  changed_by UUID,
  changed_by_username TEXT NOT NULL,
  changed_by_type TEXT NOT NULL DEFAULT 'admin' CHECK (changed_by_type IN ('admin', 'customer', 'system')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indeksy dla performance
CREATE INDEX idx_reservation_changes_reservation ON public.reservation_changes(reservation_id);
CREATE INDEX idx_reservation_changes_instance ON public.reservation_changes(instance_id);
CREATE INDEX idx_reservation_changes_batch ON public.reservation_changes(batch_id);
CREATE INDEX idx_reservation_changes_created ON public.reservation_changes(created_at);

-- 2. RLS
ALTER TABLE public.reservation_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own instance changes" ON public.reservation_changes
  FOR SELECT USING (can_access_instance(instance_id));

-- 3. Trigger AFTER INSERT (snapshot)
CREATE OR REPLACE FUNCTION public.log_reservation_created()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_batch_id UUID := gen_random_uuid();
  v_changed_by_type TEXT;
BEGIN
  -- Pobierz username
  SELECT username INTO v_username FROM profiles WHERE id = auth.uid();
  
  -- Ustal typ na podstawie source
  v_changed_by_type := CASE 
    WHEN NEW.source IN ('customer', 'calendar', 'online') THEN 'customer'
    ELSE 'admin'
  END;

  INSERT INTO reservation_changes (
    reservation_id, instance_id, change_type, field_name,
    old_value, new_value, batch_id,
    changed_by, changed_by_username, changed_by_type
  ) VALUES (
    NEW.id, NEW.instance_id, 'created', NULL,
    NULL,
    jsonb_build_object(
      'service_ids', NEW.service_ids,
      'reservation_date', NEW.reservation_date,
      'end_date', NEW.end_date,
      'start_time', NEW.start_time,
      'end_time', NEW.end_time,
      'station_id', NEW.station_id,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'vehicle_plate', NEW.vehicle_plate,
      'car_size', NEW.car_size,
      'price', NEW.price,
      'status', NEW.status,
      'admin_notes', NEW.admin_notes,
      'offer_number', NEW.offer_number
    ),
    v_batch_id,
    auth.uid(),
    COALESCE(v_username, NEW.created_by_username, NEW.customer_name, 'System'),
    v_changed_by_type
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_created
  AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_created();

-- 4. Trigger AFTER UPDATE (DIFF per field)
CREATE OR REPLACE FUNCTION public.log_reservation_updated()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_batch_id UUID := gen_random_uuid();
  v_changed_by_type TEXT := 'admin';
  v_has_changes BOOLEAN := FALSE;
BEGIN
  -- Pobierz username
  SELECT username INTO v_username FROM profiles WHERE id = auth.uid();
  
  -- Jeśli zmiana pochodzi od klienta (change_requested)
  IF NEW.status = 'change_requested' AND OLD.status IS DISTINCT FROM 'change_requested' THEN
    v_changed_by_type := 'customer';
  END IF;

  -- Porównaj każde pole i zapisz tylko zmienione

  -- service_ids
  IF OLD.service_ids IS DISTINCT FROM NEW.service_ids THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'service_ids', to_jsonb(OLD.service_ids), to_jsonb(NEW.service_ids), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- reservation_date + end_date (jako jedno pole 'dates')
  IF OLD.reservation_date IS DISTINCT FROM NEW.reservation_date OR OLD.end_date IS DISTINCT FROM NEW.end_date THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'dates', 
      jsonb_build_object('reservation_date', OLD.reservation_date, 'end_date', OLD.end_date),
      jsonb_build_object('reservation_date', NEW.reservation_date, 'end_date', NEW.end_date),
      v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- start_time + end_time (jako jedno pole 'times')
  IF OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'times',
      jsonb_build_object('start_time', OLD.start_time, 'end_time', OLD.end_time),
      jsonb_build_object('start_time', NEW.start_time, 'end_time', NEW.end_time),
      v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- station_id
  IF OLD.station_id IS DISTINCT FROM NEW.station_id THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'station_id', to_jsonb(OLD.station_id), to_jsonb(NEW.station_id), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- price
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'price', to_jsonb(OLD.price), to_jsonb(NEW.price), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- customer_name
  IF OLD.customer_name IS DISTINCT FROM NEW.customer_name THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'customer_name', to_jsonb(OLD.customer_name), to_jsonb(NEW.customer_name), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- vehicle_plate
  IF OLD.vehicle_plate IS DISTINCT FROM NEW.vehicle_plate THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'vehicle_plate', to_jsonb(OLD.vehicle_plate), to_jsonb(NEW.vehicle_plate), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- car_size
  IF OLD.car_size IS DISTINCT FROM NEW.car_size THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'car_size', to_jsonb(OLD.car_size), to_jsonb(NEW.car_size), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- admin_notes
  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'admin_notes', to_jsonb(OLD.admin_notes), to_jsonb(NEW.admin_notes), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- offer_number
  IF OLD.offer_number IS DISTINCT FROM NEW.offer_number THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'offer_number', to_jsonb(OLD.offer_number), to_jsonb(NEW.offer_number), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- change_request_note (gdy klient dodaje notatkę)
  IF NEW.change_request_note IS NOT NULL AND OLD.change_request_note IS DISTINCT FROM NEW.change_request_note THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'change_request_note', NULL, to_jsonb(NEW.change_request_note), v_batch_id, auth.uid(), COALESCE(NEW.customer_name, 'Klient'), 'customer');
    v_has_changes := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_updated
  AFTER UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_updated();