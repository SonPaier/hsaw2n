

# Szkolenia (Trainings) - Pelny Plan Implementacji

## Opis funkcjonalnosci

Nowy typ wpisu w kalendarzu: **Szkolenie**. Studio detailingowe prowadzi 3 typy szkolen:

| Typ (enum) | Labelka PL | Domyslne dni | Cena netto |
|------------|-----------|-------------|-----------|
| `group_basic` | Grupowe podstawowe | 1 | 1 100 zl/os |
| `individual` | Indywidualne | 2 | 6 000 zl |
| `master` | MASTER z instruktorem | 2 | 9 000 zl |

Szkolenia maja status: **otwarte** (rozowe) lub **wyprzedane** (magenta). Funkcja wlaczana per instancja przez feature flag `trainings` w `instance_features`.

---

## 1. Migracja bazy danych

### Enum `training_type`

```text
CREATE TYPE public.training_type AS ENUM ('group_basic', 'individual', 'master');
```

### Tabela `trainings`

```text
CREATE TABLE public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL,
  training_type training_type NOT NULL DEFAULT 'individual',
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  station_id UUID,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'sold_out'
  assigned_employee_ids JSONB DEFAULT '[]',
  photo_urls TEXT[],
  created_by UUID,
  created_by_username TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trainings" ON public.trainings
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
  );

CREATE POLICY "Employees can view trainings" ON public.trainings
  FOR SELECT USING (
    has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
  );

CREATE POLICY "Hall can view trainings" ON public.trainings
  FOR SELECT USING (
    has_instance_role(auth.uid(), 'hall'::app_role, instance_id)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.trainings;
```

Brak osobnej tabeli `training_types` - enum + logika FE + i18n wystarczy.
Brak kolumny w `instances` - feature flag przez istniejacy mechanizm `instance_features`.

---

## 2. Feature flag

Przez istniejacy system: tabela `instance_features`, hook `useInstanceFeatures`, hook `useCombinedFeatures`.

### Zmiany w plikach:

- **`src/hooks/useInstanceFeatures.ts`** - dodanie `trainings: boolean` do interfejsu `InstanceFeatures` i `defaultFeatures`
- **`src/hooks/useCombinedFeatures.ts`** - dodanie `'trainings'` do typu `FeatureKey`
- **`src/components/admin/InstanceFeaturesSettings.tsx`** - nowy wpis w `AVAILABLE_FEATURES`:
  - key: `trainings`, name: "Szkolenia", description: "Zarzadzanie szkoleniami w kalendarzu", icon: `GraduationCap`, isPaid: false

---

## 3. Tlumaczenia

### `src/i18n/locales/pl.json` - nowa sekcja `trainings`:

```text
"trainings": {
  "newTraining": "Nowe szkolenie",
  "addTraining": "Dodaj szkolenie",
  "saveTraining": "Zapisz szkolenie",
  "editTraining": "Edytuj szkolenie",
  "deleteTraining": "Usun szkolenie",
  "deleteConfirm": "Czy na pewno chcesz usunac to szkolenie?",
  "type": "Typ szkolenia",
  "description": "Opis",
  "statusOpen": "Otwarte",
  "statusSoldOut": "Wyprzedane",
  "trainingDeleted": "Szkolenie usuniete",
  "trainingSaved": "Szkolenie zapisane",
  "trainingUpdated": "Szkolenie zaktualizowane",
  "types": {
    "group_basic": "Grupowe podstawowe",
    "individual": "Indywidualne",
    "master": "MASTER z instruktorem"
  }
}
```

---

## 4. Nowe komponenty

### `src/components/admin/AddTrainingDrawer.tsx`

Sheet (drawer) do tworzenia i edycji szkolenia. Sekcje:

1. **Typ szkolenia** - Select z 3 opcji enum (`group_basic`, `individual`, `master`), labelki z `t('trainings.types.xxx')`. Po wybraniu automatycznie:
   - Ustawia `title` (labelka typu)
   - Ustawia liczbe dni: `group_basic` = 1 dzien (single), `individual`/`master` = 2 dni (multi) i przelacza toggle
   - Ustawia godziny domyslne z working hours (open-close)

2. **Daty i godziny** - re-uzycie istniejacego `ReservationDateTimeSection` z `src/components/admin/reservation-form/`. Komponent juz obsluguje toggle jednodniowa/wielodniowa, kalendarz, selektory godzin, stanowisko (`showStationSelector=true`)

3. **Opis** - Textarea na notatki/opis szkolenia

4. **Pracownicy** - re-uzycie istniejacego `EmployeeSelectionDrawer`

Footer: przycisk "Dodaj szkolenie" / "Zapisz szkolenie"
Tryb edycji: pre-fill z istniejacego szkolenia (przekazanego jako prop `editingTraining`)

### `src/components/admin/TrainingDetailsDrawer.tsx`

Sheet (drawer) szczegolow szkolenia. Zawartosc:

- **Naglowek**: Typ szkolenia (badge z kolorem) + tytul + status (otwarte/wyprzedane)
- **Sekcje**: Opis, daty i godziny, stanowisko, przypisani pracownicy, zdjecia
- **Przelacznik statusu**: Otwarte (`bg-pink-200`) / Wyprzedane (`bg-fuchsia-600`) - zmiana bezposrednio w bazie
- **Akcje w footer**: Edytuj, Usun, Dodaj zdjecia
- **Brak**: SMS, protokol, rozpocznij prace, potwierdz, dane klienta, dane pojazdu

---

## 5. Zmiany w istniejacych komponentach

### `src/components/admin/AddReservationDialogV2.tsx`

Nowe propsy: `trainingsEnabled: boolean`, `onSwitchToTraining: () => void`

Gdy spelnione warunki: `trainingsEnabled && !editingReservation && mode === 'reservation'`:
- Naglowek "Nowa rezerwacja" staje sie `DropdownMenu` z dwoma opcjami:
  - "Nowa rezerwacja" (aktywna, aktualny widok)
  - "Nowe szkolenie" -> wywoluje `onSwitchToTraining` ktory zamyka drawer rezerwacji i otwiera `AddTrainingDrawer`

Gdy warunki nie spelnione (edycja, yard mode, feature OFF): naglowek bez zmian.

### `src/components/admin/AdminCalendar.tsx`

Nowe propsy:
- `trainings: Training[]` - tablica szkolen do wyswietlenia
- `onTrainingClick: (training: Training) => void` - callback klikniecia bloku szkolenia
- `trainingsEnabled: boolean` - czy feature jest wlaczony

Zmiany:
- Renderowanie blokow szkolen obok rezerwacji na tym samym kalendarzu:
  - Status `open`: `bg-pink-200 border-pink-300 text-pink-900`
  - Status `sold_out`: `bg-fuchsia-600 border-fuchsia-700 text-white`
  - Tytul typu szkolenia wyswietlany na karcie
- Szkolenia wielodniowe renderowane na kazdym dniu z zakresu `start_date` - `end_date`
- Klikniecie bloku szkolenia -> `onTrainingClick(training)` (nie `onReservationClick`)
- Klikniecie pustego slotu -> `onAddReservation` (BEZ ZMIAN, jak dotychczas)
- Drag & drop dziala normalnie dla szkolen (bez blokowania)
- Overlap rendering dziala standardowo (istniejacy mechanizm w kalendarzu)

### `src/hooks/useReservationsRealtime.ts`

Nowe callbacki w opcjach hooka:
- `onTrainingInsert: (training: Training) => void`
- `onTrainingUpdate: (training: Training) => void`
- `onTrainingDelete: (trainingId: string) => void`

Drugi `.on()` na tym samym kanale (jeden websocket):

```text
currentChannel = supabase
  .channel(`reservations-${instanceId}`)
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'reservations',
    filter: `instance_id=eq.${instanceId}`
  }, handleReservationPayload)       // istniejacy
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'trainings',
    filter: `instance_id=eq.${instanceId}`
  }, handleTrainingPayload)          // nowy
  .subscribe(...)
```

`handleTrainingPayload` - analogiczna logika do rezerwacji ale prostsza (bez mapowania serwisow, bez debounce local updates).

### `src/pages/AdminDashboard.tsx`

- Fetch szkolen z tabeli `trainings` (analogicznie do rezerwacji)
- Stan `trainings: Training[]`
- Stan `selectedTraining: Training | null` + `trainingDetailsOpen: boolean`
- Stan `addTrainingOpen: boolean` + `editingTraining: Training | null`
- Przekazanie callbackow training do `useReservationsRealtime`
- Przekazanie `trainings`, `onTrainingClick`, `trainingsEnabled` do `AdminCalendar`
- Przekazanie `trainingsEnabled`, `onSwitchToTraining` do `AddReservationDialogV2`
- Callback `onSwitchToTraining`: zamyka `AddReservationDialogV2`, otwiera `AddTrainingDrawer`
- Renderowanie `AddTrainingDrawer` i `TrainingDetailsDrawer`

### `src/pages/HallView.tsx`

- Fetch szkolen z tabeli `trainings` (read-only)
- Przekazanie do `AdminCalendar` jako prop `trainings`
- Klikniecie bloku szkolenia otwiera `TrainingDetailsDrawer` w trybie podgladu (RLS pozwala tylko SELECT dla hall)

---

## 6. Logika interakcji na kalendarzu (podsumowanie)

| Akcja | trainings OFF | trainings ON |
|-------|-------------|-------------|
| Klikniecie pustego slotu | Otwiera `AddReservationDialogV2` | Otwiera `AddReservationDialogV2` (bez zmian) |
| Klikniecie bloku rezerwacji | Otwiera `ReservationDetailsDrawer` | Otwiera `ReservationDetailsDrawer` (bez zmian) |
| Klikniecie bloku szkolenia | N/A | Otwiera `TrainingDetailsDrawer` |
| Naglowek drawera tworzenia | "Nowa rezerwacja" (tekst) | Dropdown: "Nowa rezerwacja" / "Nowe szkolenie" |

---

## 7. Edge cases

| Scenariusz | Rozwiazanie |
|-----------|-------------|
| Szkolenia wielodniowe a dni zamkniete | Nie wystepuje - szkolenia nie obejmuja dni zamknietych |
| Enum `training_type` wymaga nowego typu w przyszlosci | Migracja `ALTER TYPE training_type ADD VALUE 'new_type'` |
| Hall view - pracownik probuje edytowac szkolenie | RLS SELECT only - drawer otwiera sie w trybie read-only |
| Wiele szkolen w tym samym dniu/stanowisku | Overlap rendering (istniejacy mechanizm w AdminCalendar) |
| Usuwanie szkolenia z przypisanymi pracownikami | Brak FK - `assigned_employee_ids` to JSONB, usuwanie proste |
| Feature flag OFF | Zero zmian w UI - brak dropdown, brak blokow szkolen, brak drawerow |

---

## 8. Kolejnosc implementacji

1. Migracja bazy (enum `training_type`, tabela `trainings`, RLS, realtime)
2. Tlumaczenia w `pl.json`
3. Feature flag: `useInstanceFeatures` + `useCombinedFeatures` + `InstanceFeaturesSettings`
4. `AddTrainingDrawer` (re-uzycie `ReservationDateTimeSection`, `EmployeeSelectionDrawer`)
5. Dropdown w headerze `AddReservationDialogV2` + prop `onSwitchToTraining`
6. `TrainingDetailsDrawer`
7. `AdminCalendar` - renderowanie blokow szkolen + `onTrainingClick`
8. `useReservationsRealtime` - drugi `.on()` dla `trainings`
9. `AdminDashboard` - fetch, stany, koordynacja drawerow
10. `HallView` - fetch i wyswietlanie read-only

---

## 9. Checklist koncowy

### Baza danych
- [ ] Enum `training_type` istnieje w bazie (`group_basic`, `individual`, `master`)
- [ ] Tabela `trainings` istnieje z poprawnymi kolumnami
- [ ] RLS: admin moze CRUD
- [ ] RLS: employee moze SELECT
- [ ] RLS: hall moze SELECT
- [ ] Tabela `trainings` dodana do `supabase_realtime`

### Feature flag
- [ ] `useInstanceFeatures.ts`: klucz `trainings` w interfejsie `InstanceFeatures`
- [ ] `useInstanceFeatures.ts`: `trainings: false` w `defaultFeatures`
- [ ] `useCombinedFeatures.ts`: `trainings` w typie `FeatureKey`
- [ ] `InstanceFeaturesSettings.tsx`: wpis `trainings` w `AVAILABLE_FEATURES` z ikona `GraduationCap`

### Tlumaczenia
- [ ] `pl.json`: sekcja `trainings` z labelkami typow, statusow i akcji
- [ ] Labelki typow: `group_basic`, `individual`, `master`
- [ ] Labelki statusow: `statusOpen`, `statusSoldOut`

### AddTrainingDrawer
- [ ] Formularz tworzy nowe szkolenie w bazie
- [ ] Formularz edytuje istniejace szkolenie
- [ ] Select typu szkolenia z 3 opcji
- [ ] Wybor typu auto-ustawia: tytul, liczbe dni (1 lub 2), godziny z working hours
- [ ] Re-uzywa `ReservationDateTimeSection` do zarzadzania datami/godzinami/stanowiskiem
- [ ] Re-uzywa `EmployeeSelectionDrawer` do przypisywania pracownikow
- [ ] Pole opisu (textarea) dziala
- [ ] Przycisk footer: "Dodaj szkolenie" (tworzenie) / "Zapisz szkolenie" (edycja)

### TrainingDetailsDrawer
- [ ] Wyswietla typ szkolenia jako badge
- [ ] Wyswietla tytul, opis, daty, godziny
- [ ] Wyswietla przypisanych pracownikow
- [ ] Wyswietla zdjecia
- [ ] Przelacznik statusu: otwarte <-> wyprzedane (zapisuje w bazie)
- [ ] Kolory statusu: otwarte = rozowe, wyprzedane = magenta
- [ ] Akcja: Edytuj (otwiera `AddTrainingDrawer` w trybie edycji)
- [ ] Akcja: Usun (z potwierdzeniem)
- [ ] Akcja: Dodaj zdjecia
- [ ] Brak: SMS, protokol, rozpocznij prace, potwierdz
- [ ] Brak: dane klienta, dane pojazdu

### AddReservationDialogV2 - dropdown
- [ ] Dropdown widoczny gdy: `trainingsEnabled && !editingReservation && mode === 'reservation'`
- [ ] Dropdown ukryty gdy: feature OFF
- [ ] Dropdown ukryty gdy: tryb edycji
- [ ] Dropdown ukryty gdy: tryb yard
- [ ] Opcja "Nowe szkolenie" wywoluje `onSwitchToTraining`
- [ ] `onSwitchToTraining` zamyka drawer rezerwacji i otwiera `AddTrainingDrawer`

### AdminCalendar
- [ ] Przyjmuje prop `trainings`
- [ ] Renderuje bloki szkolen na kalendarzu
- [ ] Kolor `open`: `bg-pink-200 border-pink-300 text-pink-900`
- [ ] Kolor `sold_out`: `bg-fuchsia-600 border-fuchsia-700 text-white`
- [ ] Tytul typu szkolenia widoczny na karcie
- [ ] Szkolenia wielodniowe widoczne na kazdym dniu z zakresu
- [ ] Klikniecie bloku szkolenia -> `onTrainingClick` (otwiera TrainingDetailsDrawer)
- [ ] Klikniecie bloku rezerwacji -> `onReservationClick` (bez zmian)
- [ ] Klikniecie pustego slotu -> `onAddReservation` (bez zmian)
- [ ] Drag & drop dziala normalnie dla szkolen
- [ ] Overlap rendering dziala dla szkolen obok rezerwacji

### Realtime
- [ ] `useReservationsRealtime.ts`: drugi `.on()` dla tabeli `trainings` na tym samym kanale
- [ ] Callback `onTrainingInsert` dodaje szkolenie do stanu
- [ ] Callback `onTrainingUpdate` aktualizuje szkolenie w stanie
- [ ] Callback `onTrainingDelete` usuwa szkolenie ze stanu
- [ ] Jeden websocket (brak dodatkowego kanalu)

### AdminDashboard
- [ ] Fetch szkolen z tabeli `trainings`
- [ ] Przekazanie szkolen do `AdminCalendar`
- [ ] Przekazanie `trainingsEnabled` i `onSwitchToTraining` do `AddReservationDialogV2`
- [ ] Koordynacja: `onSwitchToTraining` zamyka drawer rezerwacji, otwiera drawer szkolenia
- [ ] Klikniecie szkolenia na kalendarzu otwiera `TrainingDetailsDrawer`
- [ ] Edycja z `TrainingDetailsDrawer` otwiera `AddTrainingDrawer` w trybie edycji

### HallView
- [ ] Fetch szkolen z tabeli `trainings`
- [ ] Przekazanie do kalendarza
- [ ] Klikniecie otwiera `TrainingDetailsDrawer` w trybie read-only

### Regresja
- [ ] Istniejace rezerwacje dzialaja bez zmian (tworzenie, edycja, szczegoly)
- [ ] Realtime rezerwacji nie zepsuty po dodaniu drugiego `.on()`
- [ ] Feature flag OFF: zero zmian w UI (brak dropdown, brak blokow, brak drawerow)
- [ ] Tryb yard dziala bez zmian
- [ ] Kalendarz: nawigacja, widoki (dzien, 2 dni, tydzien) dzialaja bez zmian

