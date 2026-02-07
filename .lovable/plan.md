

# Plan: Przypisywanie pracowników do stanowisk i rezerwacji

## Podsumowanie

Implementacja funkcjonalności przypisywania pracowników do stanowisk oraz do rezerwacji. Feature kontrolowany przez dwa osobne ustawienia w zakładce "Ustawienia aplikacji". Gdy włączone:
1. Przypisanie wielu pracowników do stanowiska (widoczne jako chipsy readonly w nagłówku)
2. Przypisanie wielu pracowników do rezerwacji (widoczne jako niebieskie etykiety na kartach)

---

## Zidentyfikowane problemy i rozwiązania

### 1. JSONB bez integralności - Akceptowalne
Usunięci pracownicy pozostają w `assigned_employee_ids` rezerwacji - to jest OK, bo historycznie wykonywali pracę.

### 2. Interfejs Reservation zduplikowany 6x - Stopniowa centralizacja
Interfejs `Reservation` jest zdefiniowany lokalnie w:
- `AdminCalendar.tsx`
- `HallView.tsx`  
- `ReservationDetailsDrawer.tsx`
- `ReservationsView.tsx`
- `MojaRezerwacja.tsx`
- `useReservations.ts`

Rozwiązanie: Dodanie `assigned_employee_ids` do każdego lokalnego interfejsu. Pełna centralizacja to osobne zadanie refaktoryzacji.

### 3. HallView nie pobiera ustawień instancji - Nowy hook
`HallView.tsx` nie pobiera flag feature z `instances`.

Rozwiązanie: Utworzenie hooka `useInstanceSettings` (lub rozbudowa istniejącego) do pobierania ustawień.

### 4. Historia zmian - Rozbudowa triggera
Trigger `reservation_changes` nie loguje zmian w `assigned_employee_ids`.

Rozwiązanie: Dodanie nowej sekcji w triggerze dla pola `assigned_employee_ids`.

### 5. Brak indeksów - Dodanie do migracji
Dodanie indeksów dla wydajności zapytań RLS.

---

## Faza 1: Rozszerzenie bazy danych

### 1.1 Nowe kolumny w tabeli `instances`
```sql
ALTER TABLE instances 
ADD COLUMN IF NOT EXISTS assign_employees_to_stations boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assign_employees_to_reservations boolean DEFAULT false;
```

### 1.2 Tabela powiązań pracowników ze stanowiskami
```sql
CREATE TABLE station_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(station_id, employee_id)
);

-- Indeksy dla wydajności
CREATE INDEX idx_station_employees_station_id ON station_employees(station_id);
CREATE INDEX idx_station_employees_employee_id ON station_employees(employee_id);

ALTER TABLE station_employees ENABLE ROW LEVEL SECURITY;

-- RLS: dostęp przez instance_id stanowiska
CREATE POLICY "station_employees_access" ON station_employees
  FOR ALL USING (
    station_id IN (
      SELECT id FROM stations WHERE instance_id IN (
        SELECT instance_id FROM user_instance_roles WHERE user_id = auth.uid()
      )
    )
  );
```

### 1.3 Nowa kolumna w tabeli `reservations`
```sql
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS assigned_employee_ids jsonb DEFAULT '[]'::jsonb;
```

### 1.4 Rozbudowa triggera historii zmian
```sql
-- Dodanie logowania assigned_employee_ids do istniejącego triggera
-- W funkcji log_reservation_changes():
IF OLD.assigned_employee_ids IS DISTINCT FROM NEW.assigned_employee_ids THEN
  INSERT INTO reservation_changes (...)
  VALUES (NEW.id, NEW.instance_id, 'updated', 'assigned_employee_ids', 
    COALESCE(OLD.assigned_employee_ids, '[]'::jsonb), 
    COALESCE(NEW.assigned_employee_ids, '[]'::jsonb), 
    v_batch_id, auth.uid(), COALESCE(v_username, 'System'), v_changed_by_type);
  v_has_changes := TRUE;
END IF;
```

---

## Faza 2: Ustawienia aplikacji

### 2.1 Rozbudowa `ReservationConfirmSettings.tsx`

Dodanie nowej sekcji "Przypisywanie pracowników" z dwoma osobnymi toggle:

```text
+--------------------------------------------------+
| Przypisywanie pracowników                        |
+--------------------------------------------------+
| +--------------------------------------------+   |
| | Przypisanie do stanowisk          [toggle] |   |
| | Pozwala przypisać pracowników do           |   |
| | konkretnych stanowisk                      |   |
| +--------------------------------------------+   |
| +--------------------------------------------+   |
| | Przypisanie do rezerwacji         [toggle] |   |
| | Pozwala przypisać pracowników              |   |
| | wykonujących usługę do rezerwacji          |   |
| +--------------------------------------------+   |
+--------------------------------------------------+
```

### 2.2 Nowy hook `useInstanceSettings.ts`

```typescript
interface InstanceSettings {
  assignEmployeesToStations: boolean;
  assignEmployeesToReservations: boolean;
}

export const useInstanceSettings = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['instanceSettings', instanceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('instances')
        .select('assign_employees_to_stations, assign_employees_to_reservations')
        .eq('id', instanceId)
        .single();
      return data;
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
};
```

---

## Faza 3: Drawer wyboru pracowników (reużywalny)

### 3.1 Nowy komponent `EmployeeSelectionDrawer.tsx`

Wzorowany na `ServiceSelectionDrawer`:
- Sheet wysuwany z prawej strony
- Wyszukiwarka na górze
- Lista pracowników z avatarami i imionami
- Checkbox do wielokrotnego wyboru
- Przycisk "Dodaj" na dole

```text
+---------------------------------------+
| <- Wybierz pracowników                |
+---------------------------------------+
| [Szukaj pracownika...]                |
+---------------------------------------+
| [ ] [Avatar] Jan Kowalski             |
| [x] [Avatar] Anna Nowak               |
| [ ] [Avatar] Piotr Wiśniewski         |
+---------------------------------------+
|           [ + Dodaj ]                 |
+---------------------------------------+
```

Props:
```typescript
interface EmployeeSelectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  selectedEmployeeIds: string[];
  onSelect: (employeeIds: string[]) => void;
}
```

### 3.2 Komponent `AssignedEmployeesChips.tsx`

Reużywalny komponent do wyświetlania przypisanych pracowników:

```text
+----------+ +----------+ +-----------+
| Jan K. x | | Anna N. x| | + Dodaj   |
+----------+ +----------+ +-----------+
```

Props:
```typescript
interface AssignedEmployeesChipsProps {
  employeeIds: string[];
  employees: Employee[];
  onRemove?: (id: string) => void;
  onAdd?: () => void;
  readonly?: boolean;
  variant?: 'default' | 'blue';
}
```

Styl chipsów:
- Tryb edytowalny: ciemnoszare tło (`bg-slate-700`), biały tekst, ikona X
- Tryb readonly: jasnoszare tło (`bg-slate-200`), ciemny tekst, bez X
- Wariant blue: niebieskie tło (`bg-blue-500`), biały tekst

---

## Faza 4: Przypisanie pracowników do stanowisk

### 4.1 Rozbudowa `StationsSettings.tsx`

W dialogu edycji/dodawania stanowiska (widoczne gdy toggle włączony):

```text
+-----------------------------------------+
| Edytuj stanowisko                       |
+-----------------------------------------+
| Nazwa stanowiska *                      |
| [Stanowisko 1_______________]           |
|                                         |
| Przypisani pracownicy                   |
| +----------+ +----------+ +-----------+ |
| | Jan K. x | | Anna N. x| | + Dodaj   | |
| +----------+ +----------+ +-----------+ |
+-----------------------------------------+
|   [Anuluj]        [Zapisz]              |
+-----------------------------------------+
```

### 4.2 Nagłówek stanowiska w kalendarzu

Modyfikacja `AdminCalendar.tsx` (około linii 1370-1378):
- Usunięcie labelki "wolny czas" (`freeTimeText`)
- Chipsy readonly z imionami (gdy toggle włączony)
- Skracanie gdy brak miejsca: "Jan K., Anna N. +2"

```text
+---------------------+
| Stanowisko 1        |
| [Jan K.] [Anna N.]  |  <- chipsy readonly, szare
+---------------------+
```

### 4.3 Nowy hook `useStationEmployees.ts`

```typescript
interface StationEmployeeRow {
  station_id: string;
  employee_id: string;
}

export const useStationEmployees = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['stationEmployees', instanceId],
    queryFn: async (): Promise<Map<string, string[]>> => {
      // Pobieranie i grupowanie: station_id -> employee_id[]
    },
    enabled: !!instanceId,
    staleTime: 5 * 60 * 1000,
  });
};
```

---

## Faza 5: Przypisanie pracowników do rezerwacji

### 5.1 Aktualizacja interfejsów Reservation

W każdym pliku z lokalnym `interface Reservation`:
```typescript
interface Reservation {
  // ... istniejące pola
  assigned_employee_ids?: string[] | null;
}
```

Pliki do aktualizacji:
- `AdminCalendar.tsx`
- `HallView.tsx`
- `ReservationDetailsDrawer.tsx`
- `ReservationsView.tsx`
- `useReservations.ts`

### 5.2 Rozbudowa `AddReservationDialogV2.tsx`

Nowa sekcja powyżej "Notatki wewnętrzne" (widoczna gdy toggle włączony):

```text
+--------------------------------------------------+
| Przypisani pracownicy                            |
| +----------+ +----------+ +-----------+          |
| | Jan K. x | | Anna N. x| | + Dodaj   |          |
| +----------+ +----------+ +-----------+          |
+--------------------------------------------------+
```

### 5.3 Rozbudowa `ReservationDetailsDrawer.tsx`

Sekcja "Przypisani pracownicy" pod usługami:
- Chipsy z imionami i X do usuwania
- Przycisk "+ Dodaj"
- Natychmiastowy zapis do bazy (jak przy usługach)

### 5.4 Historia zmian - wyświetlanie

Rozbudowa `HistoryTimelineItem.tsx` o obsługę pola `assigned_employee_ids`:

```typescript
case 'assigned_employee_ids': {
  const oldNames = (change.old_value || [])
    .map(id => employeesMap.get(id) || id);
  const newNames = (change.new_value || [])
    .map(id => employeesMap.get(id) || id);
  const added = newNames.filter(n => !oldNames.includes(n));
  const removed = oldNames.filter(n => !newNames.includes(n));
  content = (
    <div className="space-y-0.5">
      {added.length > 0 && <div>Dodano: {added.join(', ')}</div>}
      {removed.length > 0 && <div>Usunięto: {removed.join(', ')}</div>}
    </div>
  );
  break;
}
```

---

## Faza 6: Wyświetlanie na kartach rezerwacji

### 6.1 Karta rezerwacji w `AdminCalendar.tsx`

Pod usługami (około linii ~1670) - nowa sekcja (gdy toggle włączony):
- Niebieskie tło dla chipsów z imionami (`bg-blue-500 text-white`)

```text
+---------------------------+
| 08:00 - 10:00             |
| WZ1234 Jan Kowalski       |
| [P2] [Mycie podwozia]     | <- usługi (szare)
| [Jan K.] [Anna N.]        | <- pracownicy (niebieskie)
+---------------------------+
```

### 6.2 `HallReservationCard.tsx`

Analogicznie - niebieskie labelki z imionami. Wymaga:
1. Pobrania `useInstanceSettings` w `HallView.tsx`
2. Przekazania flagi `showEmployees` do `HallReservationCard`
3. Przekazania listy pracowników z cache

---

## Faza 7: Integracja i propagacja ustawień

### 7.1 Propagacja do HallView

`HallView.tsx` musi pobierać ustawienia instancji:

```typescript
const { data: instanceSettings } = useInstanceSettings(instanceId);
const showEmployeesOnReservations = instanceSettings?.assign_employees_to_reservations ?? false;
```

### 7.2 Propagacja do komponentów

```text
HallView
+- useInstanceSettings() -> { assign_employees_to_reservations }
+- useEmployees() -> cache pracowników
+- HallReservationCard
   +- showEmployees: boolean
   +- assignedEmployeeIds: string[]
   +- employees: Employee[]

AdminCalendar
+- useInstanceSettings() -> { assign_employees_to_stations, assign_employees_to_reservations }
+- useEmployees() -> cache pracowników
+- useStationEmployees() -> mapa station->employees
+- Station Header -> chipsy readonly
+- ReservationCard -> niebieskie chipsy
```

---

## Struktura plików

### Nowe pliki:
```
src/components/admin/EmployeeSelectionDrawer.tsx
src/components/admin/AssignedEmployeesChips.tsx
src/hooks/useStationEmployees.ts
src/hooks/useInstanceSettings.ts
```

### Modyfikowane pliki:
```
src/components/admin/ReservationConfirmSettings.tsx  (toggle'e)
src/components/admin/StationsSettings.tsx            (sekcja pracowników)
src/components/admin/AdminCalendar.tsx               (nagłówek + karty + interface)
src/components/admin/AddReservationDialogV2.tsx      (sekcja pracowników)
src/components/admin/ReservationDetailsDrawer.tsx    (sekcja pracowników + interface)
src/components/admin/halls/HallReservationCard.tsx   (labelki pracowników)
src/pages/HallView.tsx                               (ustawienia + interface)
src/components/admin/ReservationsView.tsx            (interface)
src/hooks/useReservations.ts                         (interface)
src/components/admin/history/HistoryTimelineItem.tsx (wyświetlanie historii)
src/services/reservationHistoryService.ts            (ikona dla assigned_employee_ids)
```

---

## Detale techniczne

1. Cache pracowników: Istniejący `useEmployees` z 5min staleTime - bez realtime
2. Invalidacja: Tylko przy mutacjach (add/edit/delete employee)
3. Visibility: Wszystkie elementy UI widoczne tylko gdy odpowiedni toggle włączony
4. Chipsy w stanowisku: Readonly (bez X, bez Dodaj) - tylko w nagłówku kalendarza
5. Chipsy w rezerwacji edycja: Edytowalne (z X, z Dodaj)
6. Chipsy na karcie rezerwacji: Readonly, niebieskie, bez X
7. JSONB integralność: Usunięci pracownicy pozostają w historii - akceptowalne
8. Interfejsy: Tymczasowo dodanie pola do lokalnych interfejsów; pełna centralizacja = osobny refactor

---

## Checklist weryfikacyjny (Double Check)

Po zakończeniu implementacji wszystkich faz, wykonaj następującą weryfikację:

### Baza danych
- [ ] Kolumny `assign_employees_to_stations` i `assign_employees_to_reservations` istnieją w tabeli `instances`
- [ ] Tabela `station_employees` istnieje z poprawnymi FK i UNIQUE constraint
- [ ] Indeksy `idx_station_employees_station_id` i `idx_station_employees_employee_id` utworzone
- [ ] RLS policy na `station_employees` działa poprawnie (test: użytkownik widzi tylko swoje)
- [ ] Kolumna `assigned_employee_ids` istnieje w tabeli `reservations`
- [ ] Trigger `log_reservation_changes` loguje zmiany w `assigned_employee_ids`

### Ustawienia aplikacji
- [ ] Toggle "Przypisanie do stanowisk" widoczny w zakładce "Ustawienia aplikacji"
- [ ] Toggle "Przypisanie do rezerwacji" widoczny w zakładce "Ustawienia aplikacji"
- [ ] Zmiana toggle'a zapisuje się do bazy i jest natychmiast widoczna
- [ ] Po odświeżeniu strony ustawienia są zachowane

### Drawer wyboru pracowników
- [ ] Drawer otwiera się poprawnie
- [ ] Wyszukiwarka filtruje pracowników po imieniu
- [ ] Checkbox zaznacza/odznacza pracowników
- [ ] Przycisk "Dodaj" zwraca wybrane ID i zamyka drawer
- [ ] Avatary pracowników wyświetlają się poprawnie (lub placeholder gdy brak zdjęcia)

### Stanowiska
- [ ] Gdy toggle WYŁĄCZONY: sekcja pracowników NIE widoczna w dialogu edycji
- [ ] Gdy toggle WŁĄCZONY: sekcja pracowników widoczna z chipsami i przyciskiem "+ Dodaj"
- [ ] Dodawanie pracownika do stanowiska zapisuje się do `station_employees`
- [ ] Usuwanie pracownika (X) działa i aktualizuje bazę
- [ ] W nagłówku stanowiska (kalendarz): chipsy readonly z imionami (gdy toggle włączony)
- [ ] W nagłówku stanowiska: labelka "wolny czas" USUNIĘTA

### Rezerwacje - formularz
- [ ] Gdy toggle WYŁĄCZONY: sekcja pracowników NIE widoczna w `AddReservationDialogV2`
- [ ] Gdy toggle WŁĄCZONY: sekcja pracowników widoczna nad notatkami
- [ ] Dodawanie/usuwanie pracowników działa i zapisuje do `assigned_employee_ids`
- [ ] Przy edycji rezerwacji: wcześniej przypisani pracownicy są załadowani

### Rezerwacje - szczegóły drawer
- [ ] Gdy toggle WYŁĄCZONY: sekcja pracowników NIE widoczna
- [ ] Gdy toggle WŁĄCZONY: sekcja pod usługami z chipsami i "+ Dodaj"
- [ ] Dodawanie/usuwanie pracowników zapisuje natychmiast do bazy
- [ ] Zmiana jest widoczna po zamknięciu i ponownym otwarciu drawera

### Karty rezerwacji
- [ ] AdminCalendar: niebieskie chipsy z imionami pod usługami (gdy toggle włączony)
- [ ] HallReservationCard: niebieskie chipsy z imionami (gdy toggle włączony)
- [ ] Chipsy są readonly (bez X)
- [ ] Gdy toggle wyłączony: chipsy NIE wyświetlają się

### Historia zmian
- [ ] Zmiana `assigned_employee_ids` tworzy wpis w `reservation_changes`
- [ ] W `HistoryTimelineItem` wyświetla się "Dodano: X" / "Usunięto: Y"
- [ ] Ikona dla `assigned_employee_ids` dodana do `reservationHistoryService.ts`

### Interfejsy TypeScript
- [ ] `AdminCalendar.tsx` - interface Reservation ma `assigned_employee_ids`
- [ ] `HallView.tsx` - interface Reservation ma `assigned_employee_ids`
- [ ] `ReservationDetailsDrawer.tsx` - interface Reservation ma `assigned_employee_ids`
- [ ] `ReservationsView.tsx` - interface Reservation ma `assigned_employee_ids`
- [ ] `useReservations.ts` - interface Reservation ma `assigned_employee_ids`
- [ ] Brak błędów TypeScript w projekcie

### Hooki
- [ ] `useInstanceSettings` zwraca poprawne wartości flag
- [ ] `useStationEmployees` zwraca mapę station_id -> employee_id[]
- [ ] Cache pracowników (`useEmployees`) działa poprawnie

### Edge cases
- [ ] Usunięcie pracownika z `employees`: pozostaje w historii rezerwacji, usuwa się z `station_employees` (CASCADE)
- [ ] Usunięcie stanowiska: usuwa wpisy z `station_employees` (CASCADE)
- [ ] Pracownik bez zdjęcia: wyświetla placeholder avatar
- [ ] Brak pracowników w systemie: drawer pokazuje pusty stan z komunikatem
- [ ] Długie imię pracownika: chipsy nie rozjeżdżają layoutu

### Performance
- [ ] Brak nadmiarowych zapytań do bazy przy nawigacji
- [ ] Cache `useEmployees` działa (5 min staleTime)
- [ ] Cache `useStationEmployees` działa (5 min staleTime)
- [ ] Cache `useInstanceSettings` działa (5 min staleTime)

### Mobile
- [ ] Drawer wyboru pracowników działa na mobile
- [ ] Chipsy nie rozjeżdżają się na małych ekranach
- [ ] Touch na chipsie (X) działa poprawnie

