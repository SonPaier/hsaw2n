
# Plan: Radio przełącznik "Jednodniowa / Wielodniowa" w formularzu rezerwacji

## Podsumowanie

Dodanie przełącznika typu radio nad polem daty, pozwalającego wybrać czy rezerwacja jest jednodniowa (domyślnie) czy wielodniowa. Kalendarz zmienia tryb z `single` na `range` w zależności od wyboru. W trybie edycji system automatycznie wykrywa typ na podstawie różnicy dat (`from !== to`).

## Logika

```text
┌─────────────────────────────────────────────────────────┐
│  Typ rezerwacji:  ( ) Jednodniowa   ( ) Wielodniowa     │
├─────────────────────────────────────────────────────────┤
│  [Kalendarz]                                            │
│  - Jednodniowa → mode="single" → 1 klik zamyka         │
│  - Wielodniowa → mode="range" → 2 kliki (od-do)        │
└─────────────────────────────────────────────────────────┘
```

**Auto-detect przy edycji:**
- `reservation_date === end_date` lub `end_date` = null → "Jednodniowa"
- `reservation_date !== end_date` → "Wielodniowa"

**Zachowanie przy przełączaniu:**
- `Wielodniowa → Jednodniowa`: ustawia `to = from`
- `Jednodniowa → Wielodniowa`: zachowuje `from`, pozwala wybrać `to`

## Zmiany w plikach

### 1. Tłumaczenia (`src/i18n/locales/pl.json`)

Dodać klucze w sekcji `addReservation` (linia ~1040):

```json
"reservationType": "Typ rezerwacji",
"singleDay": "Jednodniowa",
"multiDay": "Wielodniowa"
```

### 2. Typy (`src/components/admin/reservation-form/types.ts`)

Dodać typ:

```typescript
export type ReservationType = 'single' | 'multi';
```

### 3. Komponent sekcji daty (`src/components/admin/reservation-form/ReservationDateTimeSection.tsx`)

**Nowe props:**
```typescript
reservationType: 'single' | 'multi';
setReservationType: (type: 'single' | 'multi') => void;
```

**UI - dodać nad polem "Data" (przed `<div className="space-y-2">`)**:
```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

<div className="space-y-2">
  <Label>{t('addReservation.reservationType')}</Label>
  <RadioGroup
    value={reservationType}
    onValueChange={(val: 'single' | 'multi') => {
      markUserEditing();
      setReservationType(val);
      // Przy przełączeniu na "Jednodniowa" - sync to = from
      if (val === 'single' && dateRange?.from) {
        setDateRange({ from: dateRange.from, to: dateRange.from });
      }
    }}
    className="flex gap-4"
  >
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="single" id="res-type-single" />
      <Label htmlFor="res-type-single" className="cursor-pointer font-normal">
        {t('addReservation.singleDay')}
      </Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="multi" id="res-type-multi" />
      <Label htmlFor="res-type-multi" className="cursor-pointer font-normal">
        {t('addReservation.multiDay')}
      </Label>
    </div>
  </RadioGroup>
</div>
```

**Zmiana komponentu Calendar:**
```tsx
<Calendar
  mode={reservationType === 'single' ? 'single' : 'range'}
  defaultMonth={dateRange?.from || new Date()}
  selected={reservationType === 'single' ? dateRange?.from : dateRange}
  onSelect={(val) => {
    markUserEditing();
    onClearDateRangeError();
    if (reservationType === 'single') {
      const date = val as Date | undefined;
      if (date) {
        setDateRange({ from: date, to: date });
        setDateRangeOpen(false);
      }
    } else {
      const range = val as DateRange | undefined;
      setDateRange(range);
      if (range?.from && range?.to) {
        setDateRangeOpen(false);
      }
    }
  }}
  disabled={(date) => { /* bez zmian */ }}
  numberOfMonths={isMobile ? 1 : 2}
  locale={pl}
  className="pointer-events-auto"
/>
```

### 4. Główny komponent dialogu (`src/components/admin/AddReservationDialogV2.tsx`)

**Nowy state (sekcja ~260):**
```typescript
const [reservationType, setReservationType] = useState<'single' | 'multi'>('single');
```

**Auto-detect w trybie edycji (useEffect ~400):**
```typescript
// W bloku edycji rezerwacji - po linii setDateRange({ from: fromDate, to: toDate });
// Auto-detect reservation type
if (editingReservation.end_date && 
    editingReservation.reservation_date !== editingReservation.end_date) {
  setReservationType('multi');
} else {
  setReservationType('single');
}
```

**Reset przy tworzeniu nowej rezerwacji (linia ~532 i ~539):**
```typescript
setReservationType('single');
```

**Przekazanie props do ReservationDateTimeSection:**
```tsx
<ReservationDateTimeSection
  reservationType={reservationType}
  setReservationType={setReservationType}
  // ...pozostałe props
/>
```

### 5. Testy jednostkowe (`src/components/admin/AddReservationDialogV2.test.tsx`)

Dodać nową sekcję testów:

```typescript
describe('Reservation type toggle', () => {
  it('RES-INT-060: domyślnie wyświetla radio "Jednodniowa" jako zaznaczone', async () => {
    renderComponent();
    await waitFor(() => {
      const singleRadio = screen.getByLabelText(/jednodniowa/i);
      expect(singleRadio).toBeChecked();
    });
  });

  it('RES-INT-061: wyświetla radio "Wielodniowa" jako niezaznaczone domyślnie', async () => {
    renderComponent();
    await waitFor(() => {
      const multiRadio = screen.getByLabelText(/wielodniowa/i);
      expect(multiRadio).not.toBeChecked();
    });
  });

  it('RES-INT-062: zmiana na "Wielodniowa" przełącza kalendarz na tryb range', async () => {
    const user = userEvent.setup();
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/wielodniowa/i)).toBeInTheDocument();
    });
    
    const multiRadio = screen.getByLabelText(/wielodniowa/i);
    await user.click(multiRadio);
    
    expect(multiRadio).toBeChecked();
  });

  it('RES-INT-063: edycja rezerwacji wielodniowej preselektuje "Wielodniowa"', async () => {
    const multiDayReservation = {
      ...mockEditingReservation,
      reservation_date: '2024-02-01',
      end_date: '2024-02-03',
    };
    
    renderComponent({ editingReservation: multiDayReservation });
    
    await waitFor(() => {
      const multiRadio = screen.getByLabelText(/wielodniowa/i);
      expect(multiRadio).toBeChecked();
    });
  });

  it('RES-INT-064: edycja rezerwacji jednodniowej preselektuje "Jednodniowa"', async () => {
    const singleDayReservation = {
      ...mockEditingReservation,
      reservation_date: '2024-02-01',
      end_date: '2024-02-01',
    };
    
    renderComponent({ editingReservation: singleDayReservation });
    
    await waitFor(() => {
      const singleRadio = screen.getByLabelText(/jednodniowa/i);
      expect(singleRadio).toBeChecked();
    });
  });

  it('RES-INT-065: przełączenie z "Wielodniowa" na "Jednodniowa" ustawia to = from', async () => {
    const user = userEvent.setup();
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/wielodniowa/i)).toBeInTheDocument();
    });
    
    // Przełącz na wielodniową
    const multiRadio = screen.getByLabelText(/wielodniowa/i);
    await user.click(multiRadio);
    expect(multiRadio).toBeChecked();
    
    // Przełącz z powrotem na jednodniową
    const singleRadio = screen.getByLabelText(/jednodniowa/i);
    await user.click(singleRadio);
    expect(singleRadio).toBeChecked();
  });
});
```

## Szczegóły techniczne

| Element | Szczegóły |
|---------|-----------|
| Nowe pole backend | ❌ Nie - używamy istniejących `reservation_date` + `end_date` |
| Auto-detect w edycji | ✅ `from !== to` → "Wielodniowa" |
| Domyślna wartość | "Jednodniowa" (`single`) |
| Komponent Radio | `RadioGroup` + `RadioGroupItem` z `@/components/ui/radio-group` |
| Zachowanie kalendarza | `single`: 1 klik zamyka popover; `range`: 2 kliki wymagane |

## Kolejność implementacji

1. Dodać tłumaczenia do `pl.json`
2. Dodać typ `ReservationType` do `types.ts`
3. Dodać state `reservationType` w `AddReservationDialogV2.tsx`
4. Dodać auto-detect w trybie edycji (useEffect)
5. Rozszerzyć props i UI w `ReservationDateTimeSection.tsx`
6. Zmienić logikę `Calendar` na warunkową (`mode` + `onSelect`)
7. Dodać testy jednostkowe (6 nowych przypadków)
8. Podbić wersję w `public/version.json`
