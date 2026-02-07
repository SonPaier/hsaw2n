-- Faza 1: Rozszerzenie bazy danych dla przypisywania pracowników

-- 1.1 Nowe kolumny w tabeli instances (feature flags)
ALTER TABLE instances 
ADD COLUMN IF NOT EXISTS assign_employees_to_stations boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assign_employees_to_reservations boolean DEFAULT false;

-- 1.2 Tabela powiązań pracowników ze stanowiskami
CREATE TABLE IF NOT EXISTS station_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(station_id, employee_id)
);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_station_employees_station_id ON station_employees(station_id);
CREATE INDEX IF NOT EXISTS idx_station_employees_employee_id ON station_employees(employee_id);

-- RLS
ALTER TABLE station_employees ENABLE ROW LEVEL SECURITY;

-- RLS policy: dostęp przez can_access_instance (używając station.instance_id)
CREATE POLICY "station_employees_access" ON station_employees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stations s 
      WHERE s.id = station_employees.station_id 
      AND public.can_access_instance(s.instance_id)
    )
  );

-- 1.3 Nowa kolumna w tabeli reservations
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS assigned_employee_ids jsonb DEFAULT '[]'::jsonb;

-- 1.4 Rozbudowa triggera historii zmian o assigned_employee_ids
CREATE OR REPLACE FUNCTION public.log_reservation_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    VALUES (NEW.id, NEW.instance_id, 'updated', 'service_ids', COALESCE(to_jsonb(OLD.service_ids), 'null'::jsonb), COALESCE(to_jsonb(NEW.service_ids), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
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
    VALUES (NEW.id, NEW.instance_id, 'updated', 'station_id', COALESCE(to_jsonb(OLD.station_id), 'null'::jsonb), COALESCE(to_jsonb(NEW.station_id), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- price
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'price', COALESCE(to_jsonb(OLD.price), 'null'::jsonb), COALESCE(to_jsonb(NEW.price), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'status', COALESCE(to_jsonb(OLD.status), 'null'::jsonb), COALESCE(to_jsonb(NEW.status), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- customer_name
  IF OLD.customer_name IS DISTINCT FROM NEW.customer_name THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'customer_name', COALESCE(to_jsonb(OLD.customer_name), 'null'::jsonb), COALESCE(to_jsonb(NEW.customer_name), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- vehicle_plate
  IF OLD.vehicle_plate IS DISTINCT FROM NEW.vehicle_plate THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'vehicle_plate', COALESCE(to_jsonb(OLD.vehicle_plate), 'null'::jsonb), COALESCE(to_jsonb(NEW.vehicle_plate), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- car_size
  IF OLD.car_size IS DISTINCT FROM NEW.car_size THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'car_size', COALESCE(to_jsonb(OLD.car_size), 'null'::jsonb), COALESCE(to_jsonb(NEW.car_size), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- admin_notes
  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'admin_notes', COALESCE(to_jsonb(OLD.admin_notes), 'null'::jsonb), COALESCE(to_jsonb(NEW.admin_notes), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- offer_number
  IF OLD.offer_number IS DISTINCT FROM NEW.offer_number THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'offer_number', COALESCE(to_jsonb(OLD.offer_number), 'null'::jsonb), COALESCE(to_jsonb(NEW.offer_number), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  -- change_request_note (gdy klient dodaje notatkę)
  IF NEW.change_request_note IS NOT NULL AND OLD.change_request_note IS DISTINCT FROM NEW.change_request_note THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'change_request_note', 'null'::jsonb, to_jsonb(NEW.change_request_note), v_batch_id, auth.uid(), COALESCE(NEW.customer_name, 'Klient'), 'customer');
    v_has_changes := TRUE;
  END IF;

  -- assigned_employee_ids (NOWE)
  IF OLD.assigned_employee_ids IS DISTINCT FROM NEW.assigned_employee_ids THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'assigned_employee_ids', 
      COALESCE(OLD.assigned_employee_ids, '[]'::jsonb), 
      COALESCE(NEW.assigned_employee_ids, '[]'::jsonb), 
      v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
    v_has_changes := TRUE;
  END IF;

  RETURN NEW;
END;
$function$;