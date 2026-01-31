
# Plan: Moduł Pracownicy & Czas Pracy (v3)

## Przegląd
Nowy moduł dla myjni ręcznych umożliwiający:
- Zarządzanie listą pracowników (bez kont użytkowników)
- Rejestrowanie czasu pracy (Start/Stop lub wpis ręczny)
- Śledzenie przerw i dni wolnych
- Raporty dla admina (tygodniowe, miesięczne)

## Kluczowe zmiany w v3

### Nawigacja - osobne strony z "← Wstecz"
Zgodnie z wzorcem `ReminderTemplateEditPage`:

```text
/workers                    → Widok kafelków (lista pracowników)
/workers/settings          → Ustawienia modułu (osobna strona)
/workers/:employeeId       → Detal pracownika (osobna strona)
```

Każda strona ma nagłówek:
```text
┌─────────────────────────────────────────────┐
│ ← Wstecz           Tytuł strony             │
└─────────────────────────────────────────────┘
```

### Uproszczony model pracownika
- Jedno pole `name` (label: "Imię, nazwisko lub ksywka")

### Tydzień = tydzień kalendarzowy
- Zawsze Poniedziałek → Niedziela
- Użycie `startOfWeek(date, { weekStartsOn: 1 })`

---

## Faza 1: Baza danych

### Tabela `employees`
```sql
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
```

### Tabela `time_entries`
```sql
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
      THEN EXTRACT(EPOCH FROM (end_time - start_time)) / 60
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
```

### Trigger: Atomowy entry_number
```sql
CREATE OR REPLACE FUNCTION set_entry_number()
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_entry_number
BEFORE INSERT ON time_entries
FOR EACH ROW EXECUTE FUNCTION set_entry_number();
```

### Trigger: Walidacja nakładających się wpisów
```sql
CREATE OR REPLACE FUNCTION validate_time_entry_overlap()
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_overlap
BEFORE INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION validate_time_entry_overlap();
```

### Tabela `employee_breaks` (powiązane z employee + date)
```sql
CREATE TABLE public.employee_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  break_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_breaks_employee_date ON employee_breaks(employee_id, break_date);
```

### Tabela `employee_days_off`
```sql
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
```

### Tabela `employee_edit_logs`
```sql
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
```

### Tabela `workers_settings`
```sql
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
```

### RLS Policies
```sql
-- Employees
CREATE POLICY "Admin can manage employees"
ON employees FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id))
WITH CHECK (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Hall can view employees"
ON employees FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

-- Time entries
CREATE POLICY "Admin can manage time entries"
ON time_entries FOR ALL
USING (has_instance_role(auth.uid(), 'admin'::app_role, instance_id));

CREATE POLICY "Hall can view time entries"
ON time_entries FOR SELECT
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

CREATE POLICY "Hall can insert time entries"
ON time_entries FOR INSERT
WITH CHECK (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));

CREATE POLICY "Hall can update time entries"
ON time_entries FOR UPDATE
USING (has_instance_role(auth.uid(), 'hall'::app_role, instance_id));
```

### Storage bucket
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true);
```

---

## Faza 2: Struktura plików i routing

### Struktura plików
```text
src/
├── components/
│   └── workers/
│       ├── EmployeeTile.tsx
│       ├── AddEmployeeDialog.tsx
│       ├── EmployeePhotoUpload.tsx
│       ├── TimeEntryPicker.tsx
│       ├── WeekView.tsx
│       ├── MonthSummary.tsx
│       ├── DayOffCalendar.tsx
│       ├── BreakDialog.tsx
│       └── AdminReportTable.tsx
├── pages/
│   ├── WorkersView.tsx         (lista kafelków)
│   ├── WorkersSettingsPage.tsx (ustawienia modułu)
│   └── WorkerDetailPage.tsx    (detal pracownika)
└── hooks/
    ├── useWorkers.ts
    ├── useTimeEntries.ts
    └── useWorkersSettings.ts
```

### Routing w App.tsx
```typescript
// DevRoutes - dodać przed /:view?
<Route 
  path="/workers/settings" 
  element={<ProtectedRoute requiredRole="admin"><WorkersSettingsPage /></ProtectedRoute>} 
/>
<Route 
  path="/workers/:employeeId" 
  element={<ProtectedRoute requiredRole="admin"><WorkerDetailPage /></ProtectedRoute>} 
/>
<Route 
  path="/workers" 
  element={<ProtectedRoute requiredRole="admin"><WorkersView /></ProtectedRoute>} 
/>

// InstanceAdminRoutes - analogicznie
<Route path="/workers/settings" element={...} />
<Route path="/workers/:employeeId" element={...} />
<Route path="/workers" element={...} />
```

### Nawigacja w AdminDashboard
- Nowa zakładka "Pracownicy" w `ADMIN_TABS` i `moreMenuItems`
- Ikona: `Users`
- Prowadzi do `/workers`

### Nawigacja w HallView mini-sidebar
- Nowy przycisk "Pracownicy" obok Kalendarz i Protokoły
- Prowadzi do `/workers`

---

## Faza 3: Makiety UI

### Strona 1: WorkersView (lista kafelków)
```text
┌──────────────────────────────────────────────────────────────┐
│  🕐 10:42                                   [ ⚙ ]  [ + ]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │  🔴     │  │  🟢     │  │         │  │         │         │
│  │  📷     │  │  📷     │  │  (MK)   │  │  (JN)   │         │
│  │ Marek   │  │ Tomek   │  │ Michał  │  │ Jacek   │         │
│  │         │  │ od 8:15 │  │         │  │ Wolne   │         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Nagłówek:**
- [⚙] → Nawigacja do `/workers/settings`
- [+] → Otwiera `AddEmployeeDialog`

**Kliknięcie kafelki → Nawigacja do `/workers/:employeeId`**

**Legenda kafelków:**
- 🔴 Czerwony marker = myjnia otwarta, brak wpisu, brak dnia wolnego
- 🟢 Zielony marker = pracownik w pracy (aktywny start bez stop)
- "od 8:15" = widoczne tylko dla admina
- (MK) = avatar z inicjałów gdy brak zdjęcia

### Strona 2: WorkersSettingsPage (ustawienia)
```text
┌──────────────────────────────────────────────────────────────┐
│  ← Wstecz           Ustawienia pracowników                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Start/Stop                     [ ○ OFF ]                    │
│  Pracownicy rejestrują czas przyciskami Start/Stop           │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  Przerwy                        [ ○ OFF ]                    │
│  Rejestrowanie przerw odejmowanych od czasu pracy            │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  Nadgodziny                     [ ○ OFF ]                    │
│  Obliczanie nadgodzin powyżej standardowego dnia             │
│                                                              │
│  Standardowa liczba godzin/dzień    [ 8 ]                    │
│  (widoczne gdy nadgodziny włączone)                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Przycisk "← Wstecz" → Nawigacja do `/workers`**

### Strona 3: WorkerDetailPage (detal pracownika)
```text
┌──────────────────────────────────────────────────────────────┐
│  ← Wstecz           Tomek Nowak               [ ✏️ ]        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  [ 🟢 STOP ]                                            │ │
│  │  Rozpoczęto: 08:15                                      │ │
│  │                                                          │ │
│  │  [ ☕ Przerwa ]  (widoczne gdy przerwy włączone)        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  TYDZIEŃ (Pn 27.01 - Nd 02.02)                              │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐                │
│  │ Pn  │ Wt  │ Śr  │ Cz  │ Pt  │ Sb  │ Nd  │                │
│  │ 8h  │ 7h  │ 8h  │TODAY│  —  │  —  │  —  │                │
│  │     │ 30m │     │🟢   │     │     │     │                │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘                │
│                                                              │
│  [ Szczegóły tygodnia ]  [ Dni wolne ]  [ Podsumowanie ]    │
└──────────────────────────────────────────────────────────────┘
```

**Przycisk "← Wstecz" → Nawigacja do `/workers`**
**Przycisk [✏️] → Otwiera dialog edycji pracownika (tylko admin)**

---

## Faza 4: Logika biznesowa

### Batch query dla statusu kafelków (rozwiązanie N+1)
```typescript
const fetchEmployeesWithStatus = async (instanceId: string, today: string) => {
  const { data } = await supabase
    .from('employees')
    .select(`
      *,
      today_entries:time_entries(
        id, start_time, end_time, is_auto_closed
      ),
      today_off:employee_days_off(
        id, day_off_type
      )
    `)
    .eq('instance_id', instanceId)
    .eq('active', true)
    .eq('today_entries.entry_date', today)
    .gte('today_off.date_from', today)
    .lte('today_off.date_to', today)
    .order('sort_order');
  
  return data;
};
```

### Tydzień kalendarzowy
```typescript
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { pl } from 'date-fns/locale';

const getCalendarWeek = (date: Date) => ({
  from: startOfWeek(date, { weekStartsOn: 1 }),
  to: endOfWeek(date, { weekStartsOn: 1 })
});

const formatWeekRange = (from: Date, to: Date) => 
  `${format(from, 'EEEEEE dd.MM', { locale: pl })} - ${format(to, 'EEEEEE dd.MM', { locale: pl })}`;
```

---

## Faza 5: Hooki

### useWorkers.ts
```typescript
export const useWorkers = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['workers', instanceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      return data;
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
};
```

### useWorkersWithStatus.ts
```typescript
export const useWorkersWithStatus = (instanceId: string | null) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['workers-status', instanceId, today],
    queryFn: () => fetchEmployeesWithStatus(instanceId!, today),
    enabled: !!instanceId,
    refetchInterval: 60000,
  });
};
```

---

## Sekcja techniczna

### Typy TypeScript
```typescript
interface Employee {
  id: string;
  instance_id: string;
  name: string;
  photo_url: string | null;
  hourly_rate: number | null;
  active: boolean;
  sort_order: number;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  entry_date: string;
  entry_number: number;
  start_time: string | null;
  end_time: string | null;
  total_minutes: number | null;
  entry_type: 'startstop' | 'manual';
  is_auto_closed: boolean;
}

interface EmployeeBreak {
  id: string;
  employee_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

interface WorkersSettings {
  instance_id: string;
  start_stop_enabled: boolean;
  breaks_enabled: boolean;
  overtime_enabled: boolean;
  standard_hours_per_day: number;
  report_frequency: 'weekly' | 'monthly';
  report_email: string | null;
}
```

### Kompresja zdjęć
```typescript
import { compressImage } from '@/lib/imageUtils';

const handlePhotoUpload = async (file: File) => {
  const compressed = await compressImage(file, 400, 0.8);
  // upload to employee-photos bucket
};
```

---

## Harmonogram implementacji

| Etap | Zakres | Wiadomości |
|------|--------|------------|
| 1 | Migracja bazy + RLS + Storage | 1 |
| 2 | Routing + strony szkieletowe | 1 |
| 3 | WorkersSettingsPage | 1 |
| 4 | Dodawanie/edycja pracowników + upload zdjęć | 1-2 |
| 5 | WorkersView (kafelki) | 1 |
| 6 | WorkerDetailPage (Start/Stop, tydzień) | 2 |
| 7 | Wpis ręczny czasu | 1 |
| 8 | Przerwy (oba tryby) | 1-2 |
| 9 | Dni wolne / urlopy | 1 |
| 10 | Raporty admina (tabele, podsumowania) | 1-2 |
| 11 | Dashboard admina (obecność real-time) | 1 |
| 12 | Nadgodziny + godziny otwarcia | 1 |

**Łącznie: ~14-17 wiadomości**
