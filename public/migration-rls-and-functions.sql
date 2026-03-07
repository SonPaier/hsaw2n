-- ============================================================
-- MISSING RLS POLICIES, ADVANCED FUNCTIONS & TRIGGERS
-- Run this SQL in the TARGET Supabase SQL Editor
-- AFTER migration-schema.sql has been applied
-- Generated: 2026-03-07
-- ============================================================

-- ============================================================
-- PART 1: ADVANCED FUNCTIONS (not in migration-schema.sql)
-- ============================================================

-- get_availability_blocks
CREATE OR REPLACE FUNCTION public.get_availability_blocks(_instance_id uuid, _from date, _to date)
RETURNS TABLE(block_date date, start_time time without time zone, end_time time without time zone, station_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.reservation_date AS block_date, r.start_time, r.end_time, r.station_id
  FROM public.reservations r
  WHERE r.instance_id = _instance_id
    AND r.reservation_date BETWEEN _from AND _to
    AND (r.status IS NULL OR r.status NOT IN ('cancelled', 'change_requested'))
    AND EXISTS (SELECT 1 FROM public.instances i WHERE i.id = _instance_id AND i.active = true)
  UNION ALL
  SELECT b.break_date AS block_date, b.start_time, b.end_time, b.station_id
  FROM public.breaks b
  WHERE b.instance_id = _instance_id
    AND b.break_date BETWEEN _from AND _to
    AND EXISTS (SELECT 1 FROM public.instances i WHERE i.id = _instance_id AND i.active = true)
  UNION ALL
  SELECT cd.closed_date AS block_date, '00:00:00'::time AS start_time, '23:59:00'::time AS end_time, s.id AS station_id
  FROM public.closed_days cd
  CROSS JOIN public.stations s
  WHERE cd.instance_id = _instance_id
    AND cd.closed_date BETWEEN _from AND _to
    AND s.instance_id = _instance_id AND s.active = true
    AND EXISTS (SELECT 1 FROM public.instances i WHERE i.id = _instance_id AND i.active = true);
$$;

-- update_instance_working_hours
CREATE OR REPLACE FUNCTION public.update_instance_working_hours(_instance_id uuid, _working_hours jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, _instance_id)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.instances SET working_hours = _working_hours, updated_at = now() WHERE id = _instance_id RETURNING working_hours INTO _result;
  IF _result IS NULL THEN RAISE EXCEPTION 'instance not found' USING ERRCODE = 'P0002'; END IF;
  RETURN _result;
END;
$$;

-- log_reservation_created
CREATE OR REPLACE FUNCTION public.log_reservation_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_batch_id UUID := gen_random_uuid();
  v_changed_by_type TEXT;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = auth.uid();
  v_changed_by_type := CASE WHEN NEW.source IN ('customer', 'calendar', 'online') THEN 'customer' ELSE 'admin' END;
  INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
  VALUES (NEW.id, NEW.instance_id, 'created', NULL, NULL,
    jsonb_build_object('service_ids', NEW.service_ids, 'reservation_date', NEW.reservation_date, 'end_date', NEW.end_date,
      'start_time', NEW.start_time, 'end_time', NEW.end_time, 'station_id', NEW.station_id,
      'customer_name', NEW.customer_name, 'customer_phone', NEW.customer_phone, 'vehicle_plate', NEW.vehicle_plate,
      'car_size', NEW.car_size, 'price', NEW.price, 'status', NEW.status, 'admin_notes', NEW.admin_notes, 'offer_number', NEW.offer_number),
    v_batch_id, auth.uid(), COALESCE(v_username, NEW.created_by_username, NEW.customer_name, 'System'), v_changed_by_type);
  RETURN NEW;
END;
$$;

-- log_reservation_updated
CREATE OR REPLACE FUNCTION public.log_reservation_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_batch_id UUID := gen_random_uuid();
  v_changed_by_type TEXT := 'admin';
  v_has_changes BOOLEAN := FALSE;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = auth.uid();
  IF NEW.status = 'change_requested' AND OLD.status IS DISTINCT FROM 'change_requested' THEN v_changed_by_type := 'customer'; END IF;

  IF OLD.service_ids IS DISTINCT FROM NEW.service_ids THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'service_ids', COALESCE(to_jsonb(OLD.service_ids), 'null'::jsonb), COALESCE(to_jsonb(NEW.service_ids), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.reservation_date IS DISTINCT FROM NEW.reservation_date OR OLD.end_date IS DISTINCT FROM NEW.end_date THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'dates', jsonb_build_object('reservation_date', OLD.reservation_date, 'end_date', OLD.end_date), jsonb_build_object('reservation_date', NEW.reservation_date, 'end_date', NEW.end_date), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'times', jsonb_build_object('start_time', OLD.start_time, 'end_time', OLD.end_time), jsonb_build_object('start_time', NEW.start_time, 'end_time', NEW.end_time), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.station_id IS DISTINCT FROM NEW.station_id THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'station_id', COALESCE(to_jsonb(OLD.station_id), 'null'::jsonb), COALESCE(to_jsonb(NEW.station_id), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'price', COALESCE(to_jsonb(OLD.price), 'null'::jsonb), COALESCE(to_jsonb(NEW.price), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'status', COALESCE(to_jsonb(OLD.status), 'null'::jsonb), COALESCE(to_jsonb(NEW.status), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.customer_name IS DISTINCT FROM NEW.customer_name THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'customer_name', COALESCE(to_jsonb(OLD.customer_name), 'null'::jsonb), COALESCE(to_jsonb(NEW.customer_name), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.vehicle_plate IS DISTINCT FROM NEW.vehicle_plate THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'vehicle_plate', COALESCE(to_jsonb(OLD.vehicle_plate), 'null'::jsonb), COALESCE(to_jsonb(NEW.vehicle_plate), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.car_size IS DISTINCT FROM NEW.car_size THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'car_size', COALESCE(to_jsonb(OLD.car_size), 'null'::jsonb), COALESCE(to_jsonb(NEW.car_size), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'admin_notes', COALESCE(to_jsonb(OLD.admin_notes), 'null'::jsonb), COALESCE(to_jsonb(NEW.admin_notes), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF OLD.offer_number IS DISTINCT FROM NEW.offer_number THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'offer_number', COALESCE(to_jsonb(OLD.offer_number), 'null'::jsonb), COALESCE(to_jsonb(NEW.offer_number), 'null'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  IF NEW.change_request_note IS NOT NULL AND OLD.change_request_note IS DISTINCT FROM NEW.change_request_note THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'change_request_note', 'null'::jsonb, to_jsonb(NEW.change_request_note), v_batch_id, auth.uid(), COALESCE(NEW.customer_name, 'Klient'), 'customer');
  END IF;
  IF OLD.assigned_employee_ids IS DISTINCT FROM NEW.assigned_employee_ids THEN
    INSERT INTO reservation_changes (reservation_id, instance_id, change_type, field_name, old_value, new_value, batch_id, changed_by, changed_by_username, changed_by_type)
    VALUES (NEW.id, NEW.instance_id, 'updated', 'assigned_employee_ids', COALESCE(OLD.assigned_employee_ids, '[]'::jsonb), COALESCE(NEW.assigned_employee_ids, '[]'::jsonb), v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  END IF;
  RETURN NEW;
END;
$$;

-- create_offer_history_entry
CREATE OR REPLACE FUNCTION public.create_offer_history_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _action text; _old_data jsonb; _new_data jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created'; _old_data := NULL; _new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN _action := 'status_changed_to_' || NEW.status;
    ELSE _action := 'updated'; END IF;
    _old_data := jsonb_build_object('status', OLD.status, 'total_net', OLD.total_net, 'total_gross', OLD.total_gross);
    _new_data := jsonb_build_object('status', NEW.status, 'total_net', NEW.total_net, 'total_gross', NEW.total_gross);
  END IF;
  INSERT INTO public.offer_history (offer_id, action, created_by, old_data, new_data)
  VALUES (NEW.id, _action, auth.uid(), _old_data, _new_data);
  RETURN NEW;
END;
$$;

-- create_reservation_notification
CREATE OR REPLACE FUNCTION public.create_reservation_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source = 'online' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (instance_id, type, title, message, data, is_read)
    VALUES (NEW.instance_id, 'new_reservation', 'Nowa rezerwacja online',
      'Klient ' || COALESCE(NEW.customer_name, 'Nieznany') || ' zarezerwował wizytę na ' || to_char(NEW.reservation_date, 'DD.MM.YYYY') || ' o ' || NEW.start_time::text,
      jsonb_build_object('reservation_id', NEW.id, 'customer_phone', NEW.customer_phone), false);
  END IF;
  RETURN NEW;
END;
$$;

-- update_customer_no_show_flag
CREATE OR REPLACE FUNCTION public.update_customer_no_show_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.no_show_at IS NOT NULL AND (OLD.no_show_at IS NULL) THEN
    UPDATE public.customers SET has_no_show = true WHERE phone = NEW.customer_phone AND instance_id = NEW.instance_id;
  END IF;
  RETURN NEW;
END;
$$;

-- reset_reminder_flags
CREATE OR REPLACE FUNCTION public.reset_reminder_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.reservation_date IS DISTINCT FROM NEW.reservation_date) OR (OLD.start_time IS DISTINCT FROM NEW.start_time) THEN
    NEW.reminder_1day_sent := NULL; NEW.reminder_1hour_sent := NULL;
    NEW.reminder_1day_last_attempt_at := NULL; NEW.reminder_1hour_last_attempt_at := NULL;
    NEW.reminder_failure_count := 0; NEW.reminder_permanent_failure := FALSE; NEW.reminder_failure_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- guard_hall_reservation_update
CREATE OR REPLACE FUNCTION public.guard_hall_reservation_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed_cols text[] := ARRAY['status','started_at','completed_at','checked_service_ids','photo_urls','updated_at','service_ids','service_items'];
  disallowed_cols text[];
BEGIN
  IF has_instance_role(auth.uid(), 'hall'::app_role, NEW.instance_id) THEN
    SELECT array_agg(key) INTO disallowed_cols
    FROM (SELECT e.key FROM jsonb_each(to_jsonb(NEW)) e WHERE (to_jsonb(OLD) -> e.key) IS DISTINCT FROM e.value) changed
    WHERE NOT (changed.key = ANY(allowed_cols));
    IF disallowed_cols IS NOT NULL THEN
      RAISE EXCEPTION 'Hall role cannot update columns: %', disallowed_cols USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- handle_reservation_completed
CREATE OR REPLACE FUNCTION public.handle_reservation_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM create_reservation_reminders(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- create_reservation_reminders
CREATE OR REPLACE FUNCTION public.create_reservation_reminders(p_reservation_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reservation RECORD; v_service_id UUID; v_service RECORD; v_item RECORD; v_count INTEGER := 0; v_completed_date DATE;
BEGIN
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  IF v_reservation IS NULL THEN RETURN 0; END IF;
  v_completed_date := COALESCE(v_reservation.completed_at::date, CURRENT_DATE);
  FOR v_service_id IN SELECT jsonb_array_elements_text(COALESCE(v_reservation.service_ids, '[]'::jsonb))::UUID
  LOOP
    SELECT us.*, rt.id as template_id, rt.items as template_items INTO v_service
    FROM unified_services us LEFT JOIN reminder_templates rt ON us.reminder_template_id = rt.id WHERE us.id = v_service_id;
    IF v_service.template_id IS NOT NULL AND v_service.template_items IS NOT NULL THEN
      FOR v_item IN SELECT * FROM jsonb_to_recordset(v_service.template_items) AS x(months INTEGER, service_type TEXT)
      LOOP
        INSERT INTO customer_reminders (instance_id, reminder_template_id, reservation_id, customer_name, customer_phone, vehicle_plate, scheduled_date, months_after, service_type)
        VALUES (v_reservation.instance_id, v_service.template_id, p_reservation_id, COALESCE(v_reservation.customer_name, 'Klient'), v_reservation.customer_phone,
          COALESCE(v_reservation.vehicle_plate, ''), (v_completed_date + (v_item.months * INTERVAL '1 month'))::date, v_item.months, COALESCE(v_item.service_type, 'serwis'))
        ON CONFLICT (instance_id, customer_phone, vehicle_plate, reminder_template_id, months_after) DO NOTHING;
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- generate_offer_number
CREATE OR REPLACE FUNCTION public.generate_offer_number(_instance_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _year TEXT; _month TEXT; _day TEXT; _count INTEGER; _prefix TEXT;
BEGIN
  _year := to_char(now(), 'YYYY'); _month := to_char(now(), 'MM'); _day := to_char(now(), 'DD');
  SELECT COALESCE(MAX(CASE WHEN offer_number ~ '/[0-9]+$' THEN (regexp_replace(offer_number, '.*/([0-9]+)$', '\1'))::INTEGER ELSE 0 END), 0) + 1 INTO _count
  FROM public.offers WHERE instance_id = _instance_id;
  SELECT UPPER(LEFT(slug, 3)) INTO _prefix FROM public.instances WHERE id = _instance_id;
  RETURN COALESCE(_prefix, 'OFF') || '/' || _day || '/' || _month || '/' || _year || '/' || _count::TEXT;
END;
$$;

-- cancel_reservation_by_code
CREATE OR REPLACE FUNCTION public.cancel_reservation_by_code(_confirmation_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _reservation record;
BEGIN
  UPDATE public.reservations SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE confirmation_code = _confirmation_code AND status NOT IN ('cancelled', 'completed')
  RETURNING id, instance_id, customer_name, reservation_date, start_time, service_id INTO _reservation;
  IF _reservation.id IS NOT NULL THEN
    INSERT INTO public.notifications (instance_id, type, title, description, entity_type, entity_id)
    SELECT _reservation.instance_id, 'reservation_cancelled_by_customer', 'Klient anulował rezerwację: ' || _reservation.customer_name,
      s.name || ' - ' || to_char(_reservation.reservation_date, 'DD Mon') || ' o ' || substring(_reservation.start_time::text from 1 for 5), 'reservation', _reservation.id
    FROM public.services s WHERE s.id = _reservation.service_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- request_reservation_change_by_code
CREATE OR REPLACE FUNCTION public.request_reservation_change_by_code(_original_confirmation_code text, _new_reservation_date date, _new_start_time time without time zone, _new_service_id uuid, _new_station_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, confirmation_code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _orig record; _duration_minutes integer; _new_end_time time; _new_id uuid; _new_code text; _attempts int := 0; _cutoff_hours int;
BEGIN
  SELECT r.* INTO _orig FROM public.reservations r WHERE r.confirmation_code = _original_confirmation_code LIMIT 1;
  IF _orig.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_FOUND'; END IF;
  IF _orig.status NOT IN ('confirmed', 'pending') THEN RAISE EXCEPTION 'RESERVATION_NOT_EDITABLE'; END IF;
  SELECT COALESCE(i.customer_edit_cutoff_hours, 1) INTO _cutoff_hours FROM public.instances i WHERE i.id = _orig.instance_id;
  IF (_orig.reservation_date::date + _orig.start_time) < (now() + make_interval(hours => _cutoff_hours)) THEN RAISE EXCEPTION 'EDIT_CUTOFF_PASSED'; END IF;
  IF EXISTS (SELECT 1 FROM public.reservations cr WHERE cr.original_reservation_id = _orig.id AND cr.status = 'change_requested') THEN RAISE EXCEPTION 'ALREADY_HAS_PENDING_CHANGE'; END IF;
  SELECT COALESCE(CASE _orig.car_size::text WHEN 'small' THEN COALESCE(s.duration_small, s.duration_minutes) WHEN 'medium' THEN COALESCE(s.duration_medium, s.duration_minutes) WHEN 'large' THEN COALESCE(s.duration_large, s.duration_minutes) ELSE s.duration_minutes END, s.duration_minutes, 60) INTO _duration_minutes
  FROM public.services s WHERE s.id = _new_service_id AND s.instance_id = _orig.instance_id LIMIT 1;
  IF _duration_minutes IS NULL THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;
  _new_end_time := (_new_start_time + make_interval(mins => _duration_minutes))::time;
  LOOP
    _new_code := (floor(random() * 9000000) + 1000000)::bigint::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.reservations r2 WHERE r2.confirmation_code = _new_code);
    _attempts := _attempts + 1; IF _attempts > 20 THEN RAISE EXCEPTION 'CODE_GENERATION_FAILED'; END IF;
  END LOOP;
  INSERT INTO public.reservations (instance_id, reservation_date, start_time, end_time, station_id, service_id, service_ids, customer_name, customer_phone, vehicle_plate, car_size, customer_notes, confirmation_code, status, original_reservation_id, source)
  VALUES (_orig.instance_id, _new_reservation_date, _new_start_time, _new_end_time, _new_station_id, _new_service_id, jsonb_build_array(_new_service_id), _orig.customer_name, _orig.customer_phone, _orig.vehicle_plate, _orig.car_size, _orig.customer_notes, _new_code, 'change_requested', _orig.id, 'customer')
  RETURNING reservations.id, reservations.confirmation_code INTO _new_id, _new_code;
  INSERT INTO public.notifications (instance_id, type, title, description, entity_type, entity_id)
  SELECT _orig.instance_id, 'change_request', 'Prośba o zmianę terminu: ' || _orig.customer_name,
    COALESCE(s.name, 'Usługa') || ' - ' || to_char(_new_reservation_date, 'YYYY-MM-DD') || ' o ' || to_char(_new_start_time, 'HH24:MI'), 'reservation', _new_id
  FROM public.services s WHERE s.id = _new_service_id;
  RETURN QUERY SELECT _new_id, _new_code;
END;
$$;

-- copy_global_scopes_to_instance
CREATE OR REPLACE FUNCTION public.copy_global_scopes_to_instance(_instance_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_scope RECORD; v_new_scope_id uuid; v_product RECORD; v_count integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM offer_scopes WHERE instance_id = _instance_id AND active = true) THEN RETURN 0; END IF;
  FOR v_scope IN SELECT * FROM offer_scopes WHERE source = 'global' AND instance_id IS NULL AND active = true ORDER BY sort_order
  LOOP
    INSERT INTO offer_scopes (instance_id, name, short_name, description, is_extras_scope, has_coating_upsell, sort_order, default_warranty, default_payment_terms, default_notes, default_service_info, source, active)
    VALUES (_instance_id, v_scope.name, v_scope.short_name, v_scope.description, v_scope.is_extras_scope, v_scope.has_coating_upsell, v_scope.sort_order, v_scope.default_warranty, v_scope.default_payment_terms, v_scope.default_notes, v_scope.default_service_info, 'instance', true)
    RETURNING id INTO v_new_scope_id;
    FOR v_product IN SELECT * FROM offer_scope_products WHERE scope_id = v_scope.id ORDER BY sort_order
    LOOP
      INSERT INTO offer_scope_products (scope_id, product_id, variant_name, is_default, sort_order, instance_id)
      VALUES (v_new_scope_id, v_product.product_id, v_product.variant_name, v_product.is_default, v_product.sort_order, _instance_id);
    END LOOP;
    v_count := v_count + 1;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM offer_scopes WHERE instance_id = _instance_id AND is_extras_scope = true AND active = true) THEN
    INSERT INTO offer_scopes (instance_id, name, short_name, is_extras_scope, source, active, sort_order) VALUES (_instance_id, 'Dodatki', 'Dodatki', true, 'instance', true, 999);
    v_count := v_count + 1;
  END IF;
  RETURN v_count;
END;
$$;

-- claim_reminder_1day
CREATE OR REPLACE FUNCTION public.claim_reminder_1day(p_reservation_id uuid, p_now timestamptz, p_backoff_threshold timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated_id UUID;
BEGIN
  UPDATE public.reservations SET reminder_1day_last_attempt_at = p_now
  WHERE id = p_reservation_id AND reminder_1day_sent IS NULL AND (reminder_1day_last_attempt_at IS NULL OR reminder_1day_last_attempt_at < p_backoff_threshold)
  RETURNING id INTO v_updated_id;
  RETURN v_updated_id IS NOT NULL;
END;
$$;

-- claim_reminder_1hour
CREATE OR REPLACE FUNCTION public.claim_reminder_1hour(p_reservation_id uuid, p_now timestamptz, p_backoff_threshold timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated_id UUID;
BEGIN
  UPDATE public.reservations SET reminder_1hour_last_attempt_at = p_now
  WHERE id = p_reservation_id AND reminder_1hour_sent IS NULL AND (reminder_1hour_last_attempt_at IS NULL OR reminder_1hour_last_attempt_at < p_backoff_threshold)
  RETURNING id INTO v_updated_id;
  RETURN v_updated_id IS NOT NULL;
END;
$$;

-- create_offer_reminders
CREATE OR REPLACE FUNCTION public.create_offer_reminders(p_offer_id uuid, p_completed_at timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_offer RECORD; v_product RECORD; v_template RECORD; v_reminder RECORD;
  v_count INTEGER := 0; v_scheduled_date DATE; v_processed_products UUID[] := ARRAY[]::UUID[];
  v_selected_state JSONB; v_selected_option_ids UUID[] := ARRAY[]::UUID[];
  v_selected_optional_item_ids UUID[] := ARRAY[]::UUID[];
  v_variant_id TEXT; v_upsell_id TEXT; v_item_id TEXT; v_selected_item_id UUID;
  v_customer_name TEXT; v_customer_phone TEXT; v_sms_template TEXT; v_is_upsell_option BOOLEAN;
BEGIN
  SELECT o.id, o.instance_id, o.selected_state, o.customer_data INTO v_offer FROM offers o WHERE o.id = p_offer_id;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;
  v_selected_state := v_offer.selected_state;
  v_customer_name := COALESCE(v_offer.customer_data->>'name', 'Klient');
  v_customer_phone := COALESCE(v_offer.customer_data->>'phone', '');
  IF v_selected_state IS NOT NULL THEN
    IF v_selected_state ? 'selectedVariants' AND v_selected_state->'selectedVariants' IS NOT NULL THEN
      FOR v_variant_id IN SELECT jsonb_object_keys(v_selected_state->'selectedVariants') LOOP
        IF v_selected_state->'selectedVariants'->>v_variant_id IS NOT NULL THEN
          v_selected_option_ids := array_append(v_selected_option_ids, (v_selected_state->'selectedVariants'->>v_variant_id)::UUID);
        END IF;
      END LOOP;
    END IF;
    IF v_selected_state ? 'selectedUpsells' AND v_selected_state->'selectedUpsells' IS NOT NULL THEN
      FOR v_upsell_id IN SELECT jsonb_object_keys(v_selected_state->'selectedUpsells') LOOP
        IF (v_selected_state->'selectedUpsells'->>v_upsell_id)::BOOLEAN = true THEN
          v_selected_option_ids := array_append(v_selected_option_ids, v_upsell_id::UUID);
        END IF;
      END LOOP;
    END IF;
    IF v_selected_state ? 'selectedOptionalItems' AND v_selected_state->'selectedOptionalItems' IS NOT NULL THEN
      FOR v_item_id IN SELECT jsonb_object_keys(v_selected_state->'selectedOptionalItems') LOOP
        IF (v_selected_state->'selectedOptionalItems'->>v_item_id)::BOOLEAN = true THEN
          v_selected_optional_item_ids := array_append(v_selected_optional_item_ids, v_item_id::UUID);
        END IF;
      END LOOP;
    END IF;
  END IF;
  IF array_length(v_selected_option_ids, 1) IS NULL OR array_length(v_selected_option_ids, 1) = 0 THEN
    SELECT array_agg(id) INTO v_selected_option_ids FROM offer_options WHERE offer_id = p_offer_id AND is_selected = true;
  END IF;
  FOR v_product IN
    SELECT DISTINCT ON (pl.id) ooi.id as item_id, ooi.product_id, ooi.custom_name, oo.id as option_id, oo.is_upsell as is_upsell_option, pl.name as product_name, pl.reminder_template_id
    FROM offer_options oo JOIN offer_option_items ooi ON ooi.option_id = oo.id JOIN products_library pl ON pl.id = ooi.product_id
    WHERE oo.offer_id = p_offer_id AND oo.id = ANY(v_selected_option_ids) AND ooi.product_id IS NOT NULL AND pl.reminder_template_id IS NOT NULL
  LOOP
    IF v_selected_state ? 'selectedItemInOption' AND v_selected_state->'selectedItemInOption' ? v_product.option_id::TEXT THEN
      v_selected_item_id := (v_selected_state->'selectedItemInOption'->>v_product.option_id::TEXT)::UUID;
      IF v_selected_item_id IS NOT NULL AND v_selected_item_id != v_product.item_id THEN CONTINUE; END IF;
    END IF;
    IF v_product.is_upsell_option = true AND array_length(v_selected_optional_item_ids, 1) > 0 THEN
      IF NOT (v_product.item_id = ANY(v_selected_optional_item_ids)) THEN CONTINUE; END IF;
    END IF;
    IF v_product.product_id = ANY(v_processed_products) THEN CONTINUE; END IF;
    v_processed_products := array_append(v_processed_products, v_product.product_id);
    SELECT rt.id, rt.name, rt.items, rt.sms_template INTO v_template FROM reminder_templates rt WHERE rt.id = v_product.reminder_template_id;
    IF v_template.id IS NULL THEN CONTINUE; END IF;
    v_sms_template := COALESCE(v_template.sms_template, '');
    FOR v_reminder IN SELECT * FROM jsonb_to_recordset(v_template.items) AS x(months INT, is_paid BOOLEAN, service_type TEXT)
    LOOP
      v_scheduled_date := (p_completed_at + (v_reminder.months * INTERVAL '1 month'))::DATE;
      INSERT INTO offer_reminders (offer_id, instance_id, customer_name, customer_phone, product_id, service_name, scheduled_date, months_after, is_paid, service_type, sms_template, status)
      VALUES (p_offer_id, v_offer.instance_id, v_customer_name, v_customer_phone, v_product.product_id, COALESCE(v_product.custom_name, v_product.product_name), v_scheduled_date, v_reminder.months, COALESCE(v_reminder.is_paid, false), COALESCE(v_reminder.service_type, 'inspection'), v_sms_template, 'scheduled');
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

-- upsert_customer_vehicle (overloaded with car_size)
CREATE OR REPLACE FUNCTION public.upsert_customer_vehicle(_instance_id uuid, _phone text, _model text, _plate text DEFAULT NULL, _customer_id uuid DEFAULT NULL, _car_size text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _vehicle_id UUID; _normalized_phone TEXT;
BEGIN
  _normalized_phone := regexp_replace(_phone, '^\+', '');
  INSERT INTO public.customer_vehicles (instance_id, phone, model, plate, customer_id, car_size, usage_count, last_used_at)
  VALUES (_instance_id, _normalized_phone, _model, _plate, _customer_id, _car_size, 1, now())
  ON CONFLICT (instance_id, phone, model) DO UPDATE SET
    usage_count = customer_vehicles.usage_count + 1, last_used_at = now(),
    plate = COALESCE(EXCLUDED.plate, customer_vehicles.plate),
    customer_id = COALESCE(EXCLUDED.customer_id, customer_vehicles.customer_id),
    car_size = COALESCE(EXCLUDED.car_size, customer_vehicles.car_size), updated_at = now()
  RETURNING id INTO _vehicle_id;
  RETURN _vehicle_id;
END;
$$;

-- cleanup_old_login_attempts
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM public.login_attempts WHERE created_at < now() - interval '30 days'; END;
$$;

-- set_time_entry_number
CREATE OR REPLACE FUNCTION public.set_time_entry_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.time_entries WHERE employee_id = NEW.employee_id AND entry_date = NEW.entry_date FOR UPDATE;
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO NEW.entry_number FROM public.time_entries WHERE employee_id = NEW.employee_id AND entry_date = NEW.entry_date;
  RETURN NEW;
END;
$$;

-- validate_time_entry_overlap
CREATE OR REPLACE FUNCTION public.validate_time_entry_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM time_entries WHERE employee_id = NEW.employee_id AND entry_date = NEW.entry_date AND id != NEW.id AND start_time IS NOT NULL AND end_time IS NOT NULL AND NEW.start_time < end_time AND NEW.end_time > start_time) THEN
      RAISE EXCEPTION 'Time entry overlaps with existing entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- PART 2: EXTRA TRIGGERS (not in migration-schema.sql)
-- ============================================================

-- Reservation triggers
CREATE TRIGGER on_reservation_completed AFTER UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION handle_reservation_completed();
CREATE TRIGGER trg_guard_hall_reservation_update BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION guard_hall_reservation_update();
CREATE TRIGGER trg_reservation_created AFTER INSERT ON public.reservations FOR EACH ROW EXECUTE FUNCTION log_reservation_created();
CREATE TRIGGER trg_reservation_no_show AFTER UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION update_customer_no_show_flag();
CREATE TRIGGER trg_reservation_updated AFTER UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION log_reservation_updated();
CREATE TRIGGER trigger_reservation_notification AFTER INSERT ON public.reservations FOR EACH ROW EXECUTE FUNCTION create_reservation_notification();
CREATE TRIGGER trigger_reset_reminder_flags BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION reset_reminder_flags();

-- Offer trigger
CREATE TRIGGER trigger_offer_history AFTER INSERT OR UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION create_offer_history_entry();

-- Time entries triggers
CREATE TRIGGER set_time_entry_number BEFORE INSERT ON public.time_entries FOR EACH ROW EXECUTE FUNCTION set_time_entry_number();
CREATE TRIGGER validate_time_entry_overlap BEFORE INSERT OR UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION validate_time_entry_overlap();

-- Additional updated_at triggers (missing from schema file)
CREATE TRIGGER update_price_lists_updated_at BEFORE UPDATE ON public.price_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_followup_services_updated_at BEFORE UPDATE ON public.followup_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_followup_events_updated_at BEFORE UPDATE ON public.followup_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_followup_tasks_updated_at BEFORE UPDATE ON public.followup_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_scopes_updated_at BEFORE UPDATE ON public.offer_scopes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_variants_updated_at BEFORE UPDATE ON public.offer_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_scope_variant_products_updated_at BEFORE UPDATE ON public.offer_scope_variant_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_permissions_updated_at BEFORE UPDATE ON public.employee_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_yard_vehicles_updated_at BEFORE UPDATE ON public.yard_vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sms_message_settings_updated_at BEFORE UPDATE ON public.sms_message_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_car_models_updated_at BEFORE UPDATE ON public.car_models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminder_templates_updated_at BEFORE UPDATE ON public.reminder_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_halls_updated_at BEFORE UPDATE ON public.halls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_scope_products_updated_at BEFORE UPDATE ON public.offer_scope_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_protocols_updated_at BEFORE UPDATE ON public.vehicle_protocols FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_product_categories_updated_at BEFORE UPDATE ON public.offer_product_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_unified_services_updated_at BEFORE UPDATE ON public.unified_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_unified_categories_updated_at BEFORE UPDATE ON public.unified_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_scope_extras_updated_at BEFORE UPDATE ON public.offer_scope_extras FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offer_scope_extra_products_updated_at BEFORE UPDATE ON public.offer_scope_extra_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PART 3: ALL RLS POLICIES
-- ============================================================

-- breaks
CREATE POLICY "Admins can manage breaks" ON public.breaks FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Breaks viewable by admins" ON public.breaks FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can delete breaks" ON public.breaks FOR DELETE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can insert breaks" ON public.breaks FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can update breaks" ON public.breaks FOR UPDATE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can view breaks" ON public.breaks FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- car_models
CREATE POLICY "Active car models are viewable by everyone" ON public.car_models FOR SELECT USING ((active = true) AND ((status = 'active') OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role))));
CREATE POLICY "Anyone can insert car model proposals" ON public.car_models FOR INSERT WITH CHECK ((status = 'proposal') OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "Anyone can view active car models" ON public.car_models FOR SELECT USING (active = true);
CREATE POLICY "Super admins can manage car models" ON public.car_models FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- closed_days
CREATE POLICY "Admins can manage closed days" ON public.closed_days FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can view closed_days" ON public.closed_days FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Public can view closed days for calendar" ON public.closed_days FOR SELECT USING (EXISTS (SELECT 1 FROM instances i WHERE i.id = closed_days.instance_id AND i.active = true));

-- customer_reminders
CREATE POLICY "Users can manage customer reminders for their instance" ON public.customer_reminders FOR ALL TO authenticated USING (can_access_instance(instance_id)) WITH CHECK (can_access_instance(instance_id));

-- customer_vehicles
CREATE POLICY "Admins can manage vehicles" ON public.customer_vehicles FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can insert customer_vehicles" ON public.customer_vehicles FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can update customer_vehicles" ON public.customer_vehicles FOR UPDATE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can view customer_vehicles" ON public.customer_vehicles FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- customers
CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Customers viewable by admins" ON public.customers FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can insert customers" ON public.customers FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can update customers" ON public.customers FOR UPDATE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can view customers" ON public.customers FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- employee_breaks
CREATE POLICY "Admin can manage breaks" ON public.employee_breaks FOR ALL USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Hall can insert breaks" ON public.employee_breaks FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can view breaks" ON public.employee_breaks FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- employee_days_off
CREATE POLICY "Admin can manage days off" ON public.employee_days_off FOR ALL USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Hall can create days off" ON public.employee_days_off FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can delete days off" ON public.employee_days_off FOR DELETE USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can view days off" ON public.employee_days_off FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- employee_edit_logs
CREATE POLICY "Admin can manage edit logs" ON public.employee_edit_logs FOR ALL USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- employee_permissions
CREATE POLICY "Admins can manage employee permissions" ON public.employee_permissions FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Users can view own permissions" ON public.employee_permissions FOR SELECT USING (auth.uid() = user_id);

-- employees
CREATE POLICY "Admin can manage employees" ON public.employees FOR ALL USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Hall can create employees" ON public.employees FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can update employees" ON public.employees FOR UPDATE USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can view employees" ON public.employees FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- followup_events
CREATE POLICY "Admins can manage followup events" ON public.followup_events FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Followup events viewable by admins" ON public.followup_events FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- followup_services
CREATE POLICY "Admins can manage followup services" ON public.followup_services FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Followup services viewable by admins" ON public.followup_services FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- followup_tasks
CREATE POLICY "Admins can manage followup tasks" ON public.followup_tasks FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Followup tasks viewable by admins" ON public.followup_tasks FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- halls
CREATE POLICY "Admins can manage halls" ON public.halls FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND (user_roles.role = 'super_admin'::app_role OR (user_roles.role = 'admin'::app_role AND user_roles.instance_id = halls.instance_id))));
CREATE POLICY "Employees and hall users can view halls" ON public.halls FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND (user_roles.role = 'super_admin'::app_role OR (user_roles.role = ANY(ARRAY['admin'::app_role, 'employee'::app_role, 'hall'::app_role]) AND user_roles.instance_id = halls.instance_id))));

-- instance_features
CREATE POLICY "Admins can manage instance features" ON public.instance_features FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Anyone can read enabled features" ON public.instance_features FOR SELECT USING (enabled = true);

-- instance_subscriptions
CREATE POLICY "Instance admins can view their subscription" ON public.instance_subscriptions FOR SELECT USING (instance_id IN (SELECT profiles.instance_id FROM profiles WHERE profiles.id = auth.uid()));
CREATE POLICY "Super admins can manage all subscriptions" ON public.instance_subscriptions FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role));

-- instances
CREATE POLICY "Admins can read own instance" ON public.instances FOR SELECT USING (has_instance_role(auth.uid(), 'admin'::app_role, id));
CREATE POLICY "Admins can update own instance" ON public.instances FOR UPDATE USING (has_instance_role(auth.uid(), 'admin'::app_role, id)) WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, id));
CREATE POLICY "Employees can view their instance" ON public.instances FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, id));
CREATE POLICY "Instances are viewable by everyone" ON public.instances FOR SELECT USING (active = true);
CREATE POLICY "Super admins can manage instances" ON public.instances FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- login_attempts
CREATE POLICY "Admins can view login attempts for their instance" ON public.login_attempts FOR SELECT TO authenticated USING (can_access_instance(instance_id));

-- notifications
CREATE POLICY "Admins can create notifications" ON public.notifications FOR INSERT WITH CHECK (can_access_instance(instance_id));
CREATE POLICY "Admins can delete notifications for their instance" ON public.notifications FOR DELETE USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Admins can update notifications for their instance" ON public.notifications FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Admins can view notifications for their instance" ON public.notifications FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can update notifications" ON public.notifications FOR UPDATE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can view notifications" ON public.notifications FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- offer_history
CREATE POLICY "Offer history follows offer access" ON public.offer_history FOR SELECT USING (EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_history.offer_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))));
CREATE POLICY "System can create offer history via trigger" ON public.offer_history FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_history.offer_id AND can_access_instance(o.instance_id)));
CREATE POLICY "offer_history_insert" ON public.offer_history FOR INSERT WITH CHECK ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_history_select" ON public.offer_history FOR SELECT USING ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));

-- offer_option_items
CREATE POLICY "Offer items follow option access" ON public.offer_option_items FOR ALL USING (EXISTS (SELECT 1 FROM offer_options oo JOIN offers o ON o.id = oo.offer_id WHERE oo.id = offer_option_items.option_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))));
CREATE POLICY "Public can view offer option items via valid offer" ON public.offer_option_items FOR SELECT USING ((EXISTS (SELECT 1 FROM offer_options oo JOIN offers o ON o.id = oo.offer_id WHERE oo.id = offer_option_items.option_id AND o.public_token IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid())));
CREATE POLICY "offer_option_items_delete" ON public.offer_option_items FOR DELETE USING ((get_option_instance_id(option_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_option_items_insert" ON public.offer_option_items FOR INSERT WITH CHECK ((get_option_instance_id(option_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_option_items_select" ON public.offer_option_items FOR SELECT USING ((get_option_instance_id(option_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_option_items_update" ON public.offer_option_items FOR UPDATE USING ((get_option_instance_id(option_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));

-- offer_options
CREATE POLICY "Offer options follow offer access" ON public.offer_options FOR ALL USING (EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_options.offer_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))));
CREATE POLICY "Public can view offer options via valid offer" ON public.offer_options FOR SELECT USING ((EXISTS (SELECT 1 FROM offers WHERE offers.id = offer_options.offer_id AND offers.public_token IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid())));
CREATE POLICY "offer_options_delete" ON public.offer_options FOR DELETE USING ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_options_insert" ON public.offer_options FOR INSERT WITH CHECK ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_options_select" ON public.offer_options FOR SELECT USING ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_options_update" ON public.offer_options FOR UPDATE USING ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));

-- offer_product_categories
CREATE POLICY "Admins can manage product categories" ON public.offer_product_categories FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Anyone can view active categories" ON public.offer_product_categories FOR SELECT USING (active = true);

-- offer_reminders
CREATE POLICY "Users can update offer reminders of their instance" ON public.offer_reminders FOR UPDATE USING (is_super_admin() OR can_access_instance(instance_id));
CREATE POLICY "Users can view offer reminders of their instance" ON public.offer_reminders FOR SELECT USING (is_super_admin() OR can_access_instance(instance_id));

-- offer_scope_extra_products
CREATE POLICY "Admins can manage scope extra products" ON public.offer_scope_extra_products FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Anyone can view scope extra products" ON public.offer_scope_extra_products FOR SELECT USING (true);

-- offer_scope_extras
CREATE POLICY "Admins can manage scope extras" ON public.offer_scope_extras FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Anyone can view scope extras" ON public.offer_scope_extras FOR SELECT USING (true);

-- offer_scope_products
CREATE POLICY "Users can manage offer scope products for their instance" ON public.offer_scope_products FOR ALL USING (can_access_instance(instance_id)) WITH CHECK (can_access_instance(instance_id));
CREATE POLICY "Users can view offer scope products for their instance" ON public.offer_scope_products FOR SELECT USING (can_access_instance(instance_id));

-- offer_scope_variant_products
CREATE POLICY "Admins can manage scope variant products" ON public.offer_scope_variant_products FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Anyone can view scope variant products" ON public.offer_scope_variant_products FOR SELECT USING (true);

-- offer_scope_variants
CREATE POLICY "Admins can manage scope variants" ON public.offer_scope_variants FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Anyone can view scope variants" ON public.offer_scope_variants FOR SELECT USING (true);

-- offer_scopes
CREATE POLICY "Anyone can view active scopes" ON public.offer_scopes FOR SELECT USING (active = true);
CREATE POLICY "Instance admins can manage their scopes" ON public.offer_scopes FOR ALL USING (instance_id IS NOT NULL AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)));
CREATE POLICY "Super admins can manage global scopes" ON public.offer_scopes FOR ALL USING (source = 'global' AND instance_id IS NULL AND has_role(auth.uid(), 'super_admin'::app_role));

-- offer_text_blocks
CREATE POLICY "Offer text blocks follow offer access" ON public.offer_text_blocks FOR ALL USING (EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_text_blocks.offer_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, o.instance_id))));
CREATE POLICY "Public can view offer text blocks via valid offer" ON public.offer_text_blocks FOR SELECT USING ((EXISTS (SELECT 1 FROM offers WHERE offers.id = offer_text_blocks.offer_id AND offers.public_token IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid())));
CREATE POLICY "offer_text_blocks_delete" ON public.offer_text_blocks FOR DELETE USING ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_text_blocks_insert" ON public.offer_text_blocks FOR INSERT WITH CHECK ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_text_blocks_select" ON public.offer_text_blocks FOR SELECT USING ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));
CREATE POLICY "offer_text_blocks_update" ON public.offer_text_blocks FOR UPDATE USING ((get_offer_instance_id(offer_id) IN (SELECT user_roles.instance_id FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.instance_id IS NOT NULL)) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role)));

-- offer_variants
CREATE POLICY "Admins can manage offer variants" ON public.offer_variants FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Anyone can view active variants" ON public.offer_variants FOR SELECT USING (active = true);

-- offer_views
CREATE POLICY "Admins can view offer views" ON public.offer_views FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Public can insert offer views" ON public.offer_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update own offer views" ON public.offer_views FOR UPDATE USING (true);

-- offers
CREATE POLICY "Admins can manage offers" ON public.offers FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Public update offer via token" ON public.offers FOR UPDATE USING (public_token IS NOT NULL) WITH CHECK (public_token IS NOT NULL);
CREATE POLICY "Public view offers with token" ON public.offers FOR SELECT USING (public_token IS NOT NULL OR can_access_instance(instance_id));

-- paint_colors
CREATE POLICY "Anyone can view paint colors" ON public.paint_colors FOR SELECT USING (true);
CREATE POLICY "Super admins can manage paint colors" ON public.paint_colors FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- price_lists
CREATE POLICY "Instance admins can delete own price_lists" ON public.price_lists FOR DELETE USING (instance_id IS NOT NULL AND has_instance_role(auth.uid(), 'admin'::app_role, instance_id) AND is_global = false);
CREATE POLICY "Instance admins can insert own price_lists" ON public.price_lists FOR INSERT WITH CHECK (instance_id IS NOT NULL AND has_instance_role(auth.uid(), 'admin'::app_role, instance_id) AND is_global = false);
CREATE POLICY "Instance admins can update own price_lists" ON public.price_lists FOR UPDATE USING (instance_id IS NOT NULL AND has_instance_role(auth.uid(), 'admin'::app_role, instance_id) AND is_global = false);
CREATE POLICY "Instance admins can view global price_lists" ON public.price_lists FOR SELECT USING (is_global = true);
CREATE POLICY "Instance admins can view own price_lists" ON public.price_lists FOR SELECT USING (instance_id IS NOT NULL AND has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Super admins full access on price_lists" ON public.price_lists FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- products_library
CREATE POLICY "Admins can manage instance products" ON public.products_library FOR ALL USING (instance_id IS NOT NULL AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)));
CREATE POLICY "Global products readable by everyone" ON public.products_library FOR SELECT USING (source = 'global' AND instance_id IS NULL AND active = true);
CREATE POLICY "Instance products readable by admins" ON public.products_library FOR SELECT USING (instance_id IS NOT NULL AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)));
CREATE POLICY "Public can read products via offer items" ON public.products_library FOR SELECT USING (EXISTS (SELECT 1 FROM offer_option_items ooi WHERE ooi.product_id = products_library.id));
CREATE POLICY "Super admins can manage global products" ON public.products_library FOR ALL USING (source = 'global' AND instance_id IS NULL AND has_role(auth.uid(), 'super_admin'::app_role));

-- profiles
CREATE POLICY "Anyone can lookup profile by username" ON public.profiles FOR SELECT USING (username IS NOT NULL);
CREATE POLICY "Instance admins can update instance profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role) OR (instance_id IS NOT NULL AND has_instance_role(auth.uid(), 'admin'::app_role, instance_id)));
CREATE POLICY "Instance admins can view instance profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR (instance_id IS NOT NULL AND has_instance_role(auth.uid(), 'admin'::app_role, instance_id)));
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- protocol_damage_points
CREATE POLICY "Public read access to damage points" ON public.protocol_damage_points FOR SELECT USING (true);
CREATE POLICY "Users can create damage points for their protocols" ON public.protocol_damage_points FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM vehicle_protocols vp WHERE vp.id = protocol_damage_points.protocol_id AND can_access_instance(vp.instance_id)));
CREATE POLICY "Users can delete damage points of their protocols" ON public.protocol_damage_points FOR DELETE USING (EXISTS (SELECT 1 FROM vehicle_protocols vp WHERE vp.id = protocol_damage_points.protocol_id AND can_access_instance(vp.instance_id)));
CREATE POLICY "Users can update damage points of their protocols" ON public.protocol_damage_points FOR UPDATE USING (EXISTS (SELECT 1 FROM vehicle_protocols vp WHERE vp.id = protocol_damage_points.protocol_id AND can_access_instance(vp.instance_id)));
CREATE POLICY "Users can view damage points of their protocols" ON public.protocol_damage_points FOR SELECT USING (EXISTS (SELECT 1 FROM vehicle_protocols vp WHERE vp.id = protocol_damage_points.protocol_id AND can_access_instance(vp.instance_id)));

-- push_subscriptions
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own subscriptions" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- reminder_templates
CREATE POLICY "Users can create reminder templates for their instance" ON public.reminder_templates FOR INSERT WITH CHECK (is_super_admin() OR can_access_instance(instance_id));
CREATE POLICY "Users can delete reminder templates of their instance" ON public.reminder_templates FOR DELETE USING (is_super_admin() OR can_access_instance(instance_id));
CREATE POLICY "Users can update reminder templates of their instance" ON public.reminder_templates FOR UPDATE USING (is_super_admin() OR can_access_instance(instance_id));
CREATE POLICY "Users can view reminder templates of their instance" ON public.reminder_templates FOR SELECT USING (is_super_admin() OR can_access_instance(instance_id));

-- reservation_changes
CREATE POLICY "Admins can read own instance changes" ON public.reservation_changes FOR SELECT USING (can_access_instance(instance_id));

-- reservation_events
CREATE POLICY "Public can insert reservation_events" ON public.reservation_events FOR INSERT WITH CHECK (reservation_id IS NOT NULL AND instance_id IS NOT NULL AND instance_id = get_reservation_instance_id(reservation_id) AND event_type = ANY(ARRAY['viewed', 'cancelled']));
CREATE POLICY "Super admin can read reservation_events" ON public.reservation_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role));

-- reservations
CREATE POLICY "Admins can manage reservations" ON public.reservations FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can insert reservations" ON public.reservations FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can update reservations" ON public.reservations FOR UPDATE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can view reservations" ON public.reservations FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Hall can update reservation workflow fields" ON public.reservations FOR UPDATE USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can view reservations" ON public.reservations FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Public can create change request" ON public.reservations FOR INSERT WITH CHECK (status = 'change_requested'::reservation_status AND original_reservation_id IS NOT NULL AND EXISTS (SELECT 1 FROM reservations r WHERE r.id = r.original_reservation_id));
CREATE POLICY "Public can view reservation by confirmation_code" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "Reservations viewable by admins" ON public.reservations FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- sales_order_items
CREATE POLICY "Admins can manage sales order items" ON public.sales_order_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_items.order_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, so.instance_id))));

-- sales_orders
CREATE POLICY "Admins can manage sales orders" ON public.sales_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- sales_products
CREATE POLICY "Users can manage sales products for their instance" ON public.sales_products FOR ALL TO authenticated USING (can_access_instance(instance_id)) WITH CHECK (can_access_instance(instance_id));

-- service_categories
CREATE POLICY "Admins can manage categories" ON public.service_categories FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Categories are viewable by everyone" ON public.service_categories FOR SELECT USING (active = true);
CREATE POLICY "Employees can view service_categories" ON public.service_categories FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

-- services
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can view services" ON public.services FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (active = true);

-- sms_logs
CREATE POLICY "Admins can view SMS logs" ON public.sms_logs FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- sms_message_settings
CREATE POLICY "Admins can manage SMS settings" ON public.sms_message_settings FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "SMS settings viewable by admins" ON public.sms_message_settings FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- sms_verification_codes
CREATE POLICY "Admins can view verification codes" ON public.sms_verification_codes FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()));

-- station_employees
CREATE POLICY "station_employees_access" ON public.station_employees FOR ALL USING (EXISTS (SELECT 1 FROM stations s WHERE s.id = station_employees.station_id AND can_access_instance(s.instance_id)));

-- stations
CREATE POLICY "Admins can manage stations" ON public.stations FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can view stations" ON public.stations FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Stations are viewable by everyone" ON public.stations FOR SELECT USING (active = true);

-- subscription_plans
CREATE POLICY "Anyone can view active subscription plans" ON public.subscription_plans FOR SELECT USING (active = true);
CREATE POLICY "Super admins can manage subscription plans" ON public.subscription_plans FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'::app_role));

-- text_blocks_library
CREATE POLICY "Admins can manage instance text blocks" ON public.text_blocks_library FOR ALL USING (instance_id IS NOT NULL AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)));
CREATE POLICY "Global text blocks readable by everyone" ON public.text_blocks_library FOR SELECT USING (source = 'global' AND instance_id IS NULL AND active = true);
CREATE POLICY "Instance text blocks readable by admins" ON public.text_blocks_library FOR SELECT USING (instance_id IS NOT NULL AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)));
CREATE POLICY "Super admins can manage global text blocks" ON public.text_blocks_library FOR ALL USING (source = 'global' AND instance_id IS NULL AND has_role(auth.uid(), 'super_admin'::app_role));

-- time_entries
CREATE POLICY "Admin can manage time entries" ON public.time_entries FOR ALL USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Hall can insert time entries" ON public.time_entries FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can update time entries" ON public.time_entries FOR UPDATE USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
CREATE POLICY "Hall can view time entries" ON public.time_entries FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- training_types
CREATE POLICY "Admins can manage training types" ON public.training_types FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can view training types" ON public.training_types FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Hall can view training types" ON public.training_types FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- trainings
CREATE POLICY "Admins can manage trainings" ON public.trainings FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can view trainings" ON public.trainings FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Hall can view trainings" ON public.trainings FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- unified_categories
CREATE POLICY "Admins can manage categories" ON public.unified_categories FOR ALL USING (can_access_instance(instance_id));
CREATE POLICY "Users can view categories for their instance" ON public.unified_categories FOR SELECT USING (can_access_instance(instance_id));

-- unified_services
CREATE POLICY "Admins can manage services" ON public.unified_services FOR ALL USING (can_access_instance(instance_id));
CREATE POLICY "Public can read service descriptions" ON public.unified_services FOR SELECT TO anon USING (true);
CREATE POLICY "Users can view services for their instance" ON public.unified_services FOR SELECT USING (can_access_instance(instance_id));

-- user_roles
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- vehicle_protocols
CREATE POLICY "Public read access to protocols via token" ON public.vehicle_protocols FOR SELECT USING (true);
CREATE POLICY "Users can create protocols for their instance" ON public.vehicle_protocols FOR INSERT WITH CHECK (can_access_instance(instance_id));
CREATE POLICY "Users can delete protocols of their instance" ON public.vehicle_protocols FOR DELETE USING (can_access_instance(instance_id));
CREATE POLICY "Users can update protocols of their instance" ON public.vehicle_protocols FOR UPDATE USING (can_access_instance(instance_id));
CREATE POLICY "Users can view protocols of their instance" ON public.vehicle_protocols FOR SELECT USING (can_access_instance(instance_id));

-- workers_settings
CREATE POLICY "Admin can manage workers settings" ON public.workers_settings FOR ALL USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id)) WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Hall can view workers settings" ON public.workers_settings FOR SELECT USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- yard_vehicles
CREATE POLICY "Admins can manage yard vehicles" ON public.yard_vehicles FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));
CREATE POLICY "Employees can delete yard_vehicles" ON public.yard_vehicles FOR DELETE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can insert yard_vehicles" ON public.yard_vehicles FOR INSERT WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can update yard_vehicles" ON public.yard_vehicles FOR UPDATE USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Employees can view yard_vehicles" ON public.yard_vehicles FOR SELECT USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
CREATE POLICY "Yard vehicles viewable by admins" ON public.yard_vehicles FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- ============================================================
-- PART 4: REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Done!
