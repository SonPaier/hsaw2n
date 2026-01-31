
# Plan: Uproszczenie kafelków czasu pracy z konfiguracją trybu liczenia

## Problem

Obecnie kafelek pracownika pokazuje 3 linie czasu:
- **Łącznie** - całkowity czas od start do stop
- **Przed otwarciem** - czas przed godziną otwarcia myjni  
- **Od otwarcia** - czas po otwarciu (realny)

To jest zbyt skomplikowane. Chcemy uproszczony widok z jedną wartością "Czas" w zależności od konfiguracji.

## Rozwiązanie

Dodajemy nowe ustawienie: **"Jak liczyć czas?"** (widoczne tylko gdy Start/Stop włączony)

| Opcja | Opis | Logika |
|-------|------|--------|
| `start_to_stop` (domyślna) | Od kliknięcia start do stop | Czas = suma wszystkich wpisów |
| `opening_to_stop` | Od otwarcia myjni do stop | Czas = suma - czas przed otwarciem |

**Edge case:** Jeśli wybrano `opening_to_stop`, ale nie znaleziono godziny otwarcia (np. niedziela bez godzin), używamy czasu od start.

## Zmiany w bazie danych

```sql
ALTER TABLE workers_settings 
ADD COLUMN time_calculation_mode TEXT NOT NULL DEFAULT 'start_to_stop';

COMMENT ON COLUMN workers_settings.time_calculation_mode IS 
  'start_to_stop = od kliknięcia start, opening_to_stop = od godziny otwarcia';
```

## Zmiany w plikach

### 1. `src/hooks/useWorkersSettings.ts`

Dodać pole do interfejsu:

```typescript
export interface WorkersSettings {
  // ...istniejące pola...
  time_calculation_mode: 'start_to_stop' | 'opening_to_stop';
}
```

### 2. `src/components/admin/employees/WorkersSettingsDrawer.tsx`

Dodać nową sekcję RadioGroup (widoczną tylko gdy `startStopEnabled === true`):

```
{startStopEnabled && (
  <div className="space-y-3">
    <Label>Jak liczyć czas?</Label>
    <RadioGroup value={timeCalculationMode} ...>
      <RadioGroupItem value="start_to_stop">
        Od kliknięcia start do stop
      </RadioGroupItem>
      <RadioGroupItem value="opening_to_stop">
        Od otwarcia myjni do stop
      </RadioGroupItem>
    </RadioGroup>
  </div>
)}
```

### 3. `src/components/admin/employees/EmployeesView.tsx`

Uprościć logikę wyświetlania na kafelkach:

**Przed (admin widzi 4 linie):**
```
Łącznie: 8h 30min
Przed otwarciem: 0h 30min
Od otwarcia: 8h 00min
320.00 zł
```

**Po (admin widzi 2 linie):**
```
Czas: 8h 00min    (lub 8h 30min w trybie start_to_stop)
320.00 zł
```

Logika w komponencie:
```typescript
const timeCalculationMode = workersSettings?.time_calculation_mode ?? 'start_to_stop';

// W mapowaniu pracownika:
const displayMinutes = timeCalculationMode === 'opening_to_stop'
  ? realMinutes   // po odjęciu czasu przed otwarciem (lub totalMinutes jeśli brak godzin)
  : totalMinutes; // pełny czas start-stop

const displayHours = formatMinutesToTime(displayMinutes);
```

Edge case dla `opening_to_stop`:
```typescript
// Jeśli preOpeningMinutes === 0 i tryb opening_to_stop, 
// sprawdź czy to dlatego że nie ma godzin otwarcia
// W takim przypadku używamy totalMinutes
```

### 4. Aktualizacja totalEarnings

Suma wypłat zawsze bazuje na czasie wyświetlanym (displayMinutes):
```typescript
const totalEarnings = useMemo(() => {
  return activeEmployees.reduce((sum, employee) => {
    const summary = periodSummary.get(employee.id);
    if (summary && employee.hourly_rate) {
      const preOpening = preOpeningByEmployee.get(employee.id) || 0;
      const displayMinutes = timeCalculationMode === 'opening_to_stop'
        ? Math.max(0, summary.total_minutes - preOpening)
        : summary.total_minutes;
      return sum + (displayMinutes / 60) * employee.hourly_rate;
    }
    return sum;
  }, 0);
}, [activeEmployees, periodSummary, preOpeningByEmployee, timeCalculationMode]);
```

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| **Baza danych** | Migracja: dodanie kolumny `time_calculation_mode` |
| `useWorkersSettings.ts` | Dodanie typu `time_calculation_mode` do interfejsu |
| `WorkersSettingsDrawer.tsx` | Nowa sekcja RadioGroup (widoczna gdy Start/Stop włączony) |
| `EmployeesView.tsx` | Uproszczenie kafelka: 1 linia "Czas" + zarobki zamiast 3 linii |

## Wizualizacja kafelka po zmianach

**Tryb `start_to_stop`:**
```
┌─────────────────────────────┐
│ [Avatar] Jan Kowalski    ✏️ │
│          Czas: 8h 30min     │
│          320.00 zł          │
└─────────────────────────────┘
```

**Tryb `opening_to_stop`:**
```
┌─────────────────────────────┐
│ [Avatar] Jan Kowalski    ✏️ │
│          Czas: 8h 00min     │
│          320.00 zł          │
└─────────────────────────────┘
```
