-- =============================================
-- WORKERS MODULE: Phase 1 - Database Schema
-- =============================================

-- 1. Employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  hourly_rate DECIMAL(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employees_instance ON employees(instance_id);
CREATE INDEX idx_employees_active ON employees(instance_id, active);

-- 2. Time entries table with GENERATED total_minutes
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_number INTEGER NOT NULL DEFAULT 1,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  total_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN start_time IS NOT NULL AND end_time IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER / 60
      ELSE NULL
    END
  ) STORED,
  entry_type TEXT NOT NULL DEFAULT 'startstop' CHECK (entry_type IN ('startstop', 'manual')),
  is_auto_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_time_entries_employee_date ON time_entries(employee_id, entry_date);
CREATE INDEX idx_time_entries_instance_date ON time_entries(instance_id, entry_date);
CREATE INDEX idx_time_entries_active ON time_entries(instance_id, entry_date, end_time) 
  WHERE is_auto_closed = false;

-- 3. Trigger: Atomic entry_number assignment
CREATE OR REPLACE FUNCTION public.set_time_entry_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(entry_number), 0) + 1
  INTO NEW.entry_number
  FROM time_entries
  WHERE employee_id = NEW.employee_id 
    AND entry_date = NEW.entry_date
  FOR UPDATE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_set_entry_number
BEFORE INSERT ON time_entries
FOR EACH ROW EXECUTE FUNCTION public.set_time_entry_number();

-- 4. Trigger: Validate overlapping time entries
CREATE OR REPLACE FUNCTION public.validate_time_entry_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM time_entries
      WHERE employee_id = NEW.employee_id
        AND entry_date = NEW.entry_date
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND start_time IS NOT NULL AND end_time IS NOT NULL
        AND (
          (NEW.start_time >= start_time AND NEW.start_time < end_time)
          OR (NEW.end_time > start_time AND NEW.end_time <= end_time)
          OR (NEW.start_time <= start_time AND NEW.end_time >= end_time)
        )
    ) THEN
      RAISE EXCEPTION 'Time entry overlaps with existing entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_overlap
BEFORE INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_time_entry_overlap();

-- 5. Employee breaks table (linked to employee + date, not time_entry)
CREATE TABLE public.employee_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  break_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER / 60
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_breaks_employee_date ON employee_breaks(employee_id, break_date);

-- 6. Employee days off table
CREATE TABLE public.employee_days_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  day_off_type TEXT NOT NULL DEFAULT 'vacation' CHECK (day_off_type IN ('vacation', 'day_off')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (date_to >= date_from)
);

CREATE INDEX idx_days_off_employee ON employee_days_off(employee_id, date_from, date_to);

-- 7. Employee edit logs (audit trail)
CREATE TABLE public.employee_edit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('employee', 'time_entry')),
  entity_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  edited_at TIMESTAMPTZ DEFAULT now(),
  edited_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_edit_logs_entity ON employee_edit_logs(entity_type, entity_id);

-- 8. Workers settings table (per instance)
CREATE TABLE public.workers_settings (
  instance_id UUID PRIMARY KEY REFERENCES instances(id) ON DELETE CASCADE,
  start_stop_enabled BOOLEAN NOT NULL DEFAULT false,
  breaks_enabled BOOLEAN NOT NULL DEFAULT false,
  overtime_enabled BOOLEAN NOT NULL DEFAULT false,
  standard_hours_per_day INTEGER NOT NULL DEFAULT 8,
  report_frequency TEXT DEFAULT 'monthly' CHECK (report_frequency IN ('weekly', 'monthly')),
  report_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_days_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers_settings ENABLE ROW LEVEL SECURITY;

-- Employees policies
CREATE POLICY "Admin can manage employees"
ON employees FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Hall can view employees"
ON employees FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- Time entries policies
CREATE POLICY "Admin can manage time entries"
ON time_entries FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Hall can view time entries"
ON time_entries FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

CREATE POLICY "Hall can insert time entries"
ON time_entries FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

CREATE POLICY "Hall can update time entries"
ON time_entries FOR UPDATE
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- Employee breaks policies
CREATE POLICY "Admin can manage breaks"
ON employee_breaks FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Hall can view breaks"
ON employee_breaks FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

CREATE POLICY "Hall can insert breaks"
ON employee_breaks FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- Employee days off policies
CREATE POLICY "Admin can manage days off"
ON employee_days_off FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Hall can view days off"
ON employee_days_off FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- Edit logs policies (admin only)
CREATE POLICY "Admin can manage edit logs"
ON employee_edit_logs FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

-- Workers settings policies (admin only)
CREATE POLICY "Admin can manage workers settings"
ON workers_settings FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Hall can view workers settings"
ON workers_settings FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- =============================================
-- Storage bucket for employee photos
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for employee photos
CREATE POLICY "Anyone can view employee photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can upload employee photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update employee photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete employee photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');