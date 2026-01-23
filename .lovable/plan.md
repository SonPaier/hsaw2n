
# Plan: Unit testy dla AddReservationDialogV2

## Analiza komponentu

Komponent `AddReservationDialogV2.tsx` (~2850 linii) obsługuje 4 tryby:
- **reservation** - rezerwacje myjni (sloty czasowe)
- **yard** - pojazdy na placu (bez slotów)
- **ppf** - folie ochronne (zakres dat)
- **detailing** - detailing (zakres dat)

Każdy tryb ma osobną walidację i logikę zapisu.

---

## Strategia testowania

### 1. Struktura plików testowych

```text
src/components/admin/
├── AddReservationDialogV2.tsx
├── AddReservationDialogV2.test.tsx        (nowy - 35+ testów)
├── SelectedServicesList.test.tsx          (nowy - 8 testów)
└── ServiceSelectionDrawer.test.tsx        (nowy - 6 testów)
```

### 2. Mockowanie zależności

Rozszerzenie istniejącego `src/test/mocks/supabase.ts`:
- Mock dla tabel: `services`, `stations`, `customers`, `customer_vehicles`, `reservations`, `yard_vehicles`
- Mock dla RPC: `get_availability_blocks`
- Mock auth: `getUser()`

Dodatkowe mocki:
- `sonner` (toast notifications)
- `@/lib/pushNotifications` (sendPushNotification)
- `react-router-dom` (useParams, useNavigate)

---

## Przypadki testowe (35 testów)

### Grupa A: Walidacja formularza (7 testów)

| ID | Test | Opis |
|----|------|------|
| RES-U-001 | Puste pole telefonu | Submit bez telefonu pokazuje błąd "Telefon jest wymagany" |
| RES-U-002 | Puste pole model auta | Submit bez modelu pokazuje błąd "Marka i model jest wymagana" |
| RES-U-003 | Brak usług (reservation) | Submit bez usług pokazuje błąd "Wybierz co najmniej jedną usługę" |
| RES-U-004 | Brak usług (yard) | Submit bez usług w trybie yard pokazuje błąd |
| RES-U-005 | PPF: usługi opcjonalne | Submit bez usług w trybie PPF NIE pokazuje błędu |
| RES-U-006 | PPF/Detailing: brak zakresu dat | Submit bez dateRange pokazuje błąd |
| RES-U-007 | Walidacja czyszczona po wpisaniu | Wpisanie wartości w pole z błędem czyści błąd |

### Grupa B: Tryb rezerwacji - czas (6 testów)

| ID | Test | Opis |
|----|------|------|
| RES-U-010 | Brak slotu - błąd | Mode slots: submit bez selectedTime pokazuje błąd |
| RES-U-011 | Manual: brak start time | Mode manual: submit bez startTime pokazuje błąd |
| RES-U-012 | Manual: brak stacji | Mode manual: submit bez stationId pokazuje błąd |
| RES-U-013 | Zmiana start - przesuwa end | Zmiana manualStartTime automatycznie przesuwa manualEndTime |
| RES-U-014 | Dodanie usługi - wydłuża end | Dodanie usługi zwiększa czas końcowy o duration usługi |
| RES-U-015 | Usunięcie usługi - skraca end | Usunięcie usługi zmniejsza czas końcowy |

### Grupa C: Usługi i ceny (8 testów)

| ID | Test | Opis |
|----|------|------|
| RES-U-020 | Dodanie usługi | Klik na usługę w ServiceSelectionDrawer dodaje ją do listy |
| RES-U-021 | Usunięcie usługi | Klik na Trash2 usuwa usługę z listy |
| RES-U-022 | Inline edit ceny | Klik na cenę, wpisanie nowej wartości aktualizuje serviceItems |
| RES-U-023 | Net-to-brutto konwersja | Usługa z category_prices_are_net=true: 100zł netto -> 125zł brutto (123*1.23 zaokr do 5) |
| RES-U-024 | Cena wg carSize S | CarSize=small używa price_small |
| RES-U-025 | Cena wg carSize M | CarSize=medium używa price_medium |
| RES-U-026 | Cena wg carSize L | CarSize=large używa price_large |
| RES-U-027 | Total price update | Zmiana ceny inline aktualizuje finalPrice przez onTotalPriceChange |

### Grupa D: Wyszukiwanie klienta/pojazdu (5 testów)

| ID | Test | Opis |
|----|------|------|
| RES-U-030 | Dropdown po wpisaniu telefonu | Wpisanie 9 cyfr pokazuje dropdown z customer_vehicles |
| RES-U-031 | Wybór pojazdu - autofill | Klik na pojazd wypełnia carModel i carSize |
| RES-U-032 | Wybór klienta - autofill | Wybór z ClientSearchAutocomplete wypełnia name, phone, model |
| RES-U-033 | Customer vehicles pills | Klik na pill przełącza wybrany pojazd |
| RES-U-034 | Rabat klienta | Wybór klienta z discount_percent ustawia customerDiscountPercent |

### Grupa E: Tryb edycji (4 testy)

| ID | Test | Opis |
|----|------|------|
| RES-U-040 | Prefill z editingReservation | Formularz wypełniony danymi przekazanej rezerwacji |
| RES-U-041 | "Zmień termin" button | Klik pokazuje pełny edytor czasu (isChangingTime=true) |
| RES-U-042 | "Anuluj zmianę" | Klik przywraca oryginalne wartości daty/czasu |
| RES-U-043 | Ochrona przed Realtime | isUserEditingRef blokuje nadpisanie formularza |

### Grupa F: UI responsywność (3 testy)

| ID | Test | Opis |
|----|------|------|
| RES-U-050 | Tabs widoczne na mobile | setViewport('mobile') - TabsList z slots/manual widoczny |
| RES-U-051 | Tabs ukryte na desktop | setViewport('desktop') - TabsList ma klasę sm:hidden |
| RES-U-052 | Drawer hidden toggle | Mobile: przycisk peek ukrywa drawer |

### Grupa G: Zapis i API (5 testów)

| ID | Test | Opis |
|----|------|------|
| RES-U-060 | Sukces - toast + callback | Po zapisie: toast.success + onSuccess wywołany |
| RES-U-061 | Błąd API - toast error | Błąd Supabase: toast.error wyświetlony |
| RES-U-062 | Nowy klient tworzony | Jeśli customerName bez selectedCustomerId - insert do customers |
| RES-U-063 | Custom car model proposal | isCustomCarModel=true - insert do car_models ze status='proposal' |
| RES-U-064 | Push notification | Po zapisie wywołany sendPushNotification z poprawnymi parametrami |

---

## Implementacja

### Krok 1: Rozszerzenie mocków Supabase

Plik: `src/test/mocks/supabase.ts`

Dodanie:
- Mock dla `rpc('get_availability_blocks')` 
- Domyślne dane dla services, stations
- Helper `mockSupabaseRpc(name, response)`

### Krok 2: Mock dodatkowych modułów

Plik: `src/test/mocks/modules.ts` (nowy)

```text
// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock push notifications
vi.mock('@/lib/pushNotifications', () => ({
  sendPushNotification: vi.fn(),
  formatDateForPush: (d) => format(d, 'dd.MM'),
}));
```

### Krok 3: Test helper dla renderowania

Plik: `src/test/helpers/renderReservationDialog.tsx` (nowy)

```text
function renderReservationDialog(props: Partial<AddReservationDialogV2Props>) {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    instanceId: 'test-instance',
    onSuccess: vi.fn(),
    workingHours: { monday: { open: '08:00', close: '18:00' }, ... },
    mode: 'reservation' as const,
  };
  
  return render(
    <MemoryRouter>
      <AddReservationDialogV2 {...defaultProps} {...props} />
    </MemoryRouter>
  );
}
```

### Krok 4: Testy główne

Plik: `src/components/admin/AddReservationDialogV2.test.tsx`

Struktura:
```text
describe('AddReservationDialogV2', () => {
  describe('Walidacja formularza', () => { ... });
  describe('Tryb rezerwacji - czas', () => { ... });
  describe('Usługi i ceny', () => { ... });
  describe('Wyszukiwanie klienta', () => { ... });
  describe('Tryb edycji', () => { ... });
  describe('UI responsywność', () => { ... });
  describe('Zapis i API', () => { ... });
});
```

### Krok 5: Testy komponentów pomocniczych

Plik: `src/components/admin/SelectedServicesList.test.tsx`
- Renderowanie listy usług
- Inline price edit
- Net-to-brutto konwersja
- Total calculation

Plik: `src/components/admin/ServiceSelectionDrawer.test.tsx`
- Wyszukiwanie usług (search)
- Matching chips
- Kategorie i grupowanie
- Confirm selection

---

## Dane testowe

### Mock services
```text
[
  { id: 'svc-1', name: 'Mycie podstawowe', shortcut: 'MP', duration_small: 30, duration_medium: 45, duration_large: 60, price_small: 50, price_medium: 80, price_large: 120, category_prices_are_net: false },
  { id: 'svc-2', name: 'Polerowanie', shortcut: 'POL', duration_medium: 120, price_medium: 400, category_prices_are_net: true },
]
```

### Mock stations
```text
[
  { id: 'sta-1', name: 'Stanowisko 1', type: 'washing' },
  { id: 'sta-2', name: 'Stanowisko PPF', type: 'ppf' },
]
```

### Mock customer_vehicles
```text
[
  { id: 'veh-1', phone: '123456789', model: 'BMW X5', car_size: 'L', customer_name: 'Jan Kowalski' },
]
```

---

## Zależności między testami

```text
                    ┌─────────────────────┐
                    │  supabase.ts mock   │
                    │ (rozszerzony)       │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    SelectedServicesList  ServiceDrawer  AddReservationDialogV2
         (8 testów)       (6 testów)        (21 testów)
                                                  │
                              ┌───────────────────┤
                              ▼                   ▼
                        viewport.ts          modules.ts
                     (już istnieje)         (toast, push)
```

---

## Szacowany czas i objętość

- **AddReservationDialogV2.test.tsx**: ~500-600 linii
- **SelectedServicesList.test.tsx**: ~150 linii  
- **ServiceSelectionDrawer.test.tsx**: ~150 linii
- **Mocki i helpery**: ~100 linii

Łącznie: ~35 testów, ~1000 linii kodu testowego

---

## Kolejność implementacji

1. Rozszerzenie mocków (`supabase.ts`, `modules.ts`)
2. Helper `renderReservationDialog`
3. Testy `SelectedServicesList` (prostszy komponent)
4. Testy `ServiceSelectionDrawer`
5. Testy główne `AddReservationDialogV2` (walidacja -> usługi -> czas -> edycja -> API)
6. Testy responsywności (z viewport utility)
