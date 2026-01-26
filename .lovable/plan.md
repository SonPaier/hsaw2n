
# Plan: Refaktoryzacja systemu przypomnień (US-1 do US-6)

## Przegląd

Przenosimy zarządzanie przypomnieniami z modułu ofert do dedykowanego modułu `/admin/reminders`. Przypomnienia będą tworzone automatycznie przy zakończeniu rezerwacji (`status = 'completed'`), a nie z ofert.

---

## Część 1: Baza danych

### 1.1 Nowa tabela `customer_reminders`

Zastępuje (i ostatecznie usuwa) tabelę `offer_reminders`.

```sql
CREATE TABLE customer_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  reminder_template_id UUID NOT NULL REFERENCES reminder_templates(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  
  -- Denormalizowane dane klienta (dla szybkiego wyświetlania)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  
  -- Harmonogram
  scheduled_date DATE NOT NULL,
  months_after INTEGER NOT NULL,
  service_type TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled/sent/failed/cancelled
  sent_at TIMESTAMPTZ,
  
  -- Audyt
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unikalność: klient + pojazd + szablon (zapobiega duplikatom)
  UNIQUE(instance_id, customer_phone, vehicle_plate, reminder_template_id)
);

-- RLS
ALTER TABLE customer_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage customer reminders for their instance"
ON customer_reminders FOR ALL
TO authenticated
USING (can_access_instance(instance_id))
WITH CHECK (can_access_instance(instance_id));

-- Trigger updated_at
CREATE TRIGGER update_customer_reminders_updated_at
  BEFORE UPDATE ON customer_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 1.2 Funkcja `create_reservation_reminders`

Tworzy przypomnienia automatycznie po zakończeniu rezerwacji:

```sql
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
  v_template RECORD;
  v_item RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Pobierz rezerwację
  SELECT * INTO v_reservation 
  FROM reservations 
  WHERE id = p_reservation_id;
  
  IF v_reservation IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Iteruj po usługach z rezerwacji (service_ids JSONB array)
  FOR v_service_id IN 
    SELECT jsonb_array_elements_text(COALESCE(v_reservation.service_ids, '[]'::jsonb))::UUID
  LOOP
    -- Pobierz usługę z szablonem przypomnienia
    SELECT us.*, rt.id as template_id, rt.items as template_items
    INTO v_service
    FROM unified_services us
    LEFT JOIN reminder_templates rt ON us.reminder_template_id = rt.id
    WHERE us.id = v_service_id;
    
    IF v_service.template_id IS NOT NULL AND v_service.template_items IS NOT NULL THEN
      -- Iteruj po pozycjach szablonu
      FOR v_item IN 
        SELECT * FROM jsonb_to_recordset(v_service.template_items) 
        AS x(months INTEGER, service_type TEXT)
      LOOP
        -- Wstaw przypomnienie (ON CONFLICT = skip duplikat)
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
          (v_reservation.completed_at::date + (v_item.months * INTERVAL '1 month'))::date,
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
```

### 1.3 Trigger na rezerwację

```sql
CREATE OR REPLACE FUNCTION handle_reservation_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Tylko gdy status zmienia się na 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM create_reservation_reminders(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_reservation_completed
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION handle_reservation_completed();
```

### 1.4 Usunięcie starej tabeli (późniejszy krok)

Po migracji i weryfikacji:
```sql
DROP TABLE IF EXISTS offer_reminders;
```

---

## Część 2: Frontend - Nowe strony

### 2.1 Routing (`App.tsx`)

Dodanie nowych route'ów w `DevRoutes` i `InstanceAdminRoutes`:

```tsx
// Nowe route'y
<Route 
  path="/admin/reminders" 
  element={
    <ProtectedRoute requiredRole="admin">
      <RemindersListPage />
    </ProtectedRoute>
  } 
/>
<Route 
  path="/admin/reminders/:shortId" 
  element={
    <ProtectedRoute requiredRole="admin">
      <ReminderTemplateEditPage />
    </ProtectedRoute>
  } 
/>
```

### 2.2 Strona listy szablonów (`RemindersListPage.tsx`)

**Lokalizacja:** `src/pages/RemindersListPage.tsx`

**Funkcjonalność:**
- Pełnoekranowa strona
- Nagłówek: tytuł + "← Wróć do cennika" + "+ Dodaj szablon"
- Kafelki z szablonami (nazwa + liczba aktywnych klientów + menu ...)
- Desktop: kafelki podłużne (jeden pod drugim)
- Mobile: takie same kafelki
- Sortowanie alfabetyczne

**Licznik aktywnych klientów:**
```sql
SELECT 
  cr.reminder_template_id,
  COUNT(DISTINCT cr.customer_phone) as active_count
FROM customer_reminders cr
WHERE cr.instance_id = :instanceId
  AND cr.status = 'scheduled'
  AND cr.scheduled_date >= CURRENT_DATE
GROUP BY cr.reminder_template_id
```

### 2.3 Strona edycji szablonu (`ReminderTemplateEditPage.tsx`)

**Lokalizacja:** `src/pages/ReminderTemplateEditPage.tsx`

**URL:** `/admin/reminders/:shortId` (pierwsze 8 znaków UUID)

**Funkcjonalność:**
- Przycisk "← Wróć" → `/admin/reminders`
- Formularz:
  - Nazwa szablonu (wymagane)
  - Opis (opcjonalny)
  - Harmonogram przypomnień (białe kafelki)
    - Każdy kafelek: "Przypomnienie #N" | input miesiące | dropdown typ serwisu | usuń
    - "+ Dodaj przypomnienie" (bez limitu)
  - Szablon SMS (widoczny dla admina jako readonly, z przykładem)
- Przyciski: **Sticky na dole** (zarówno mobile jak i desktop)
  - Na mobile: ukryty główny bottom nav
- USUNIĘTE: toggle "Płatność" i zmienna `{paid_info}`

**Szablon SMS (hardcoded z TODO):**
```tsx
// TODO: Superadmin będzie mógł edytować szablony SMS w panelu superadmina
const SMS_TEMPLATES: Record<string, string> = {
  serwis: '{short_name}: Zapraszamy na serwis pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
  kontrola: '{short_name}: Zapraszamy na bezpłatną kontrolę pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
  serwis_gwarancyjny: '{short_name}: Zapraszamy na serwis gwarancyjny pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
  odswiezenie: '{short_name}: Zapraszamy na odświeżenie pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
};

// Przykład dla admina (readonly):
// "Armcar: Zapraszamy na serwis pojazdu WA12345. Kontakt: 123456789"
```

---

## Część 3: Modyfikacje istniejących komponentów

### 3.1 Cennik (`PriceListSettings.tsx`)

Dodanie przycisku "Przypomnienia" **obok "Kategorie"**:

```tsx
<Button 
  variant="outline" 
  onClick={() => navigate('/admin/reminders')}
  className="gap-2"
>
  <Bell className="h-4 w-4" />
  {t('reminders.title')}
</Button>
```

### 3.2 Widok produktów (`ProductsView.tsx`)

- Usunięcie przycisku "Szablony przypomnień"
- Usunięcie importu i stanu dla `ReminderTemplatesDialog`

### 3.3 Dialog zakończenia oferty (`MarkOfferCompletedDialog.tsx`)

- **Zachować** dialog z wyborem daty zakończenia
- **Usunąć** całą sekcję przypomnień (preview, logika tworzenia)
- **Usunąć** wywołanie RPC `create_offer_reminders`
- Uproszczona wersja: tylko data + przycisk "Potwierdź"

### 3.4 Widok przypomnień klienta (`CustomerRemindersTab.tsx`)

- Zmiana z tabeli `offer_reminders` na `customer_reminders`
- Pokazywanie wszystkich przypomnień (scheduled + sent + cancelled)
- Badge ze statusem

```tsx
const { data, error } = await supabase
  .from('customer_reminders')
  .select(`
    id, 
    scheduled_date, 
    months_after, 
    service_type, 
    status,
    sent_at,
    vehicle_plate,
    reminder_templates(name)
  `)
  .eq('customer_phone', customerPhone)
  .eq('instance_id', instanceId)
  .order('scheduled_date', { ascending: true });
```

### 3.5 Dialog dodawania przypomnienia klienta (`AddCustomerReminderDialog.tsx`)

- Zmiana z tabeli `offer_reminders` na `customer_reminders`
- Usunięcie pola `is_paid`
- Dodanie pola `vehicle_plate` (wymagane)

---

## Część 4: Edge Function do wysyłki SMS

### 4.1 Modyfikacja `send-offer-reminders/index.ts`

Zmiana źródła danych z `offer_reminders` na `customer_reminders`:

```typescript
// Zmiana nazwy na send-customer-reminders (lub zachowanie starej nazwy)

const { data: reminders, error } = await supabase
  .from("customer_reminders")
  .select(`
    *,
    reminder_templates(sms_template),
    instances(short_name, reservation_phone, timezone)
  `)
  .lte("scheduled_date", today)
  .eq("status", "scheduled");

// Budowanie wiadomości SMS według service_type (hardcoded templates)
// TODO: Pobierać szablony z tabeli reminder_templates
const getSmsTemplate = (serviceType: string): string => {
  const templates: Record<string, string> = {
    serwis: '{short_name}: Zapraszamy na serwis pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
    kontrola: '{short_name}: Zapraszamy na bezpłatną kontrolę pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
    serwis_gwarancyjny: '{short_name}: Zapraszamy na serwis gwarancyjny pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
    odswiezenie: '{short_name}: Zapraszamy na odświeżenie pojazdu {vehicle_plate}. Kontakt: {reservation_phone}',
  };
  return templates[serviceType] || templates.serwis;
};
```

### 4.2 CRON

Istniejący CRON `send-offer-reminders-daily` o 14:00 UTC będzie działać.

**UWAGA:** 14:00 UTC = 15:00 Europe/Warsaw (zima) lub 16:00 (lato). 
Jeśli wymaga wysyłki o 14:00 lokalnej - trzeba dostosować logikę timezone w edge function (jak w `send-reminders`).

---

## Część 5: Pliki do modyfikacji/utworzenia

| Plik | Akcja | Opis |
|------|-------|------|
| Migracja SQL | NOWY | Tabela `customer_reminders` + trigger + funkcje |
| `src/pages/RemindersListPage.tsx` | NOWY | Strona listy szablonów |
| `src/pages/ReminderTemplateEditPage.tsx` | NOWY | Strona edycji szablonu |
| `src/App.tsx` | MODYFIKACJA | Nowe route'y `/admin/reminders` |
| `src/components/admin/PriceListSettings.tsx` | MODYFIKACJA | Przycisk "Przypomnienia" |
| `src/components/admin/ProductsView.tsx` | MODYFIKACJA | Usunięcie przycisku szablonów |
| `src/components/offers/MarkOfferCompletedDialog.tsx` | MODYFIKACJA | Usunięcie sekcji przypomnień |
| `src/components/admin/CustomerRemindersTab.tsx` | MODYFIKACJA | Nowa tabela `customer_reminders` |
| `src/components/admin/AddCustomerReminderDialog.tsx` | MODYFIKACJA | Nowa tabela + vehicle_plate |
| `supabase/functions/send-offer-reminders/index.ts` | MODYFIKACJA | Nowa tabela + hardcoded templates |
| `src/i18n/locales/pl.json` | MODYFIKACJA | Nowe klucze tłumaczeń |
| `src/components/products/ReminderTemplatesDialog.tsx` | USUNIĘCIE | Po migracji |
| `src/components/products/AddReminderTemplateDialog.tsx` | REFAKTORYZACJA | Wyekstraktować logikę do nowej strony |

---

## Część 6: Diagram przepływu

```text
Cennik (PriceListSettings)
   │
   └── [Przycisk: Przypomnienia] 
         │
         ▼
/admin/reminders (RemindersListPage)
   │
   ├── [+ Dodaj szablon] ──► /admin/reminders/new
   │
   └── [Klik na kafelek] ──► /admin/reminders/:shortId (ReminderTemplateEditPage)
                                   │
                                   └── [← Wróć] ──► /admin/reminders

Rezerwacja (Kalendarz)
   │
   └── [Zmiana statusu: completed]
         │
         ▼
   [Trigger DB: on_reservation_completed]
         │
         ▼
   [Funkcja: create_reservation_reminders()]
         │
         ▼
   [INSERT customer_reminders]
   (ON CONFLICT = skip duplikat per klient+pojazd+szablon)

CRON (14:00 UTC)
   │
   └── [Edge Function: send-offer-reminders]
         │
         ▼
   [SELECT customer_reminders WHERE scheduled_date <= today]
         │
         ▼
   [Wyślij SMS + UPDATE status = 'sent']
```

---

## Część 7: Kolejność implementacji

1. **Migracja bazy** - tabela `customer_reminders` + funkcje + trigger
2. **Nowe strony** - `RemindersListPage` + `ReminderTemplateEditPage`
3. **Routing** - aktualizacja `App.tsx`
4. **Cennik** - przycisk nawigacji do `/admin/reminders`
5. **ProductsView** - usunięcie przycisku "Szablony przypomnień"
6. **MarkOfferCompletedDialog** - uproszczenie (bez przypomnień)
7. **CustomerRemindersTab** - zmiana na nową tabelę
8. **AddCustomerReminderDialog** - zmiana na nową tabelę
9. **Edge Function** - zmiana źródła danych
10. **Tłumaczenia** - nowe klucze i18n
11. **Cleanup** - usunięcie starych komponentów

---

## Sekcja techniczna

### Zmiany w schemacie `reminder_templates`

Tabela `reminder_templates` pozostaje bez zmian strukturalnych. Kolumna `items` JSONB przechowuje harmonogram:
```json
[
  { "months": 12, "service_type": "serwis" },
  { "months": 24, "service_type": "kontrola" }
]
```

**USUNIĘTE z items:** `is_paid` (per US-3)

### Hook `useAuth` - sprawdzanie superadmin

Wykorzystanie istniejącego `hasRole('super_admin')` z `useAuth()`:
```tsx
const { hasRole } = useAuth();
const isSuperAdmin = hasRole('super_admin');
```

### Logika aktywności przypomnienia (US-6)

Przypomnienie jest **aktywne** gdy:
- `status = 'scheduled'`
- `scheduled_date >= CURRENT_DATE`

Licznik "Ilość klientów" = `COUNT(DISTINCT customer_phone)` dla aktywnych przypomnień per szablon.
