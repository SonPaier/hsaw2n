

# Plan: Naprawa obliczeń czasu przed otwarciem i stawki godzinowej

## Problem

1. **Dane nie są widoczne** - obliczenia czasu przed otwarciem nie działają poprawnie z powodu problemu ze strefami czasowymi
2. **Błędne obliczanie stawki** - `totalEarnings` (suma wypłat) używa pełnego czasu zamiast czasu realnego

## Analiza techniczna

### Problem stref czasowych

Dane z bazy:
```
start_time: 2026-01-30 07:00:00+00 (UTC)
```

To oznacza 08:00 czasu polskiego (CET = UTC+1).

Obecny kod:
```typescript
const openingDate = new Date(dateStr);  // "2026-01-30" → 2026-01-30 00:00:00 CET
openingDate.setHours(8, 0, 0, 0);       // → 2026-01-30 08:00:00 CET
```

Problem: `new Date("2026-01-30 07:00:00+00")` daje czas w UTC, a `openingDate` jest w czasie lokalnym (CET). Porównanie jest niepoprawne.

### Rozwiązanie

Konwertować godzinę otwarcia do UTC na dany dzień, aby oba czasy były w tej samej strefie:

```typescript
const getOpeningTime = (dateStr: string): Date | null => {
  // ...
  // Tworzymy datę w UTC dla danego dnia
  const [year, month, day] = dateStr.split('-').map(Number);
  const openingDate = new Date(Date.UTC(year, month - 1, day, hours - 1, minutes));
  // -1 bo CET = UTC+1, więc 08:00 CET = 07:00 UTC
  return openingDate;
};
```

Lepsze rozwiązanie: parsować `start_time` do daty i porównywać godziny/minuty zamiast pełnych timestampów:

```typescript
const calculatePreOpeningMinutes = (entries: TimeEntry[], dateStr: string): number => {
  const openingHour = getOpeningHour(dateStr); // np. "08:00"
  if (!openingHour) return 0;
  
  const [openHour, openMin] = openingHour.split(':').map(Number);
  
  entries.forEach(entry => {
    if (!entry.start_time) return;
    const startTime = new Date(entry.start_time);
    const startHour = startTime.getHours(); // Czas lokalny przeglądarki
    const startMin = startTime.getMinutes();
    
    // Jeśli pracownik zaczął przed otwarciem
    if (startHour < openHour || (startHour === openHour && startMin < openMin)) {
      // ... oblicz minuty
    }
  });
};
```

## Zmiany do wprowadzenia

### 1. Naprawa `getOpeningTime` w `EmployeesView.tsx`

Zmienić na porównywanie godzin/minut w czasie lokalnym (przeglądarka już konwertuje UTC na czas lokalny):

```typescript
const getOpeningTime = (dateStr: string): Date | null => {
  if (!workingHours) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const dayKey = WEEKDAY_TO_KEY[dayOfWeek];
  const dayHours = workingHours[dayKey];
  if (!dayHours || !dayHours.open) return null;
  
  const [hours, minutes] = dayHours.open.split(':').map(Number);
  // Utwórz datę otwarcia w czasie lokalnym
  const openingDate = new Date(dateStr + 'T00:00:00');
  openingDate.setHours(hours, minutes, 0, 0);
  return openingDate;
};
```

I w `calculatePreOpeningMinutes`:
```typescript
const startTime = new Date(entry.start_time); // Automatycznie konwertowane do czasu lokalnego
```

### 2. Naprawa `totalEarnings`

Zmienić na używanie `realMinutes` (z odliczeniem czasu przed otwarciem):

```typescript
const totalEarnings = useMemo(() => {
  return activeEmployees.reduce((sum, employee) => {
    const summary = periodSummary.get(employee.id);
    if (summary && employee.hourly_rate) {
      const preOpeningMinutes = preOpeningByEmployee.get(employee.id) || 0;
      const realMinutes = Math.max(0, summary.total_minutes - preOpeningMinutes);
      return sum + (realMinutes / 60) * employee.hourly_rate;
    }
    return sum;
  }, 0);
}, [activeEmployees, periodSummary, preOpeningByEmployee]);
```

## Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `EmployeesView.tsx` | 1. Naprawić `getOpeningTime` - użyć `dateStr + 'T00:00:00'` dla poprawnej strefy czasowej |
| `EmployeesView.tsx` | 2. Naprawić `totalEarnings` - używać `realMinutes` zamiast `summary.total_minutes` |
| `EmployeesView.tsx` | 3. Dodać `preOpeningByEmployee` do zależności `useMemo` dla `totalEarnings` |

## Szczegóły implementacji

### Zmiana w `getOpeningTime` (linie ~85-97)

```typescript
const getOpeningTime = (dateStr: string): Date | null => {
  if (!workingHours) return null;
  // Użyj formatu ISO z czasem, aby uniknąć problemów ze strefami czasowymi
  const date = new Date(dateStr + 'T12:00:00'); // Użyj południa, żeby getDay() działał poprawnie
  const dayOfWeek = date.getDay();
  const dayKey = WEEKDAY_TO_KEY[dayOfWeek];
  const dayHours = workingHours[dayKey];
  if (!dayHours || !dayHours.open) return null;
  
  const [hours, minutes] = dayHours.open.split(':').map(Number);
  const openingDate = new Date(dateStr + 'T00:00:00');
  openingDate.setHours(hours, minutes, 0, 0);
  return openingDate;
};
```

### Zmiana w `totalEarnings` (linie ~152-161)

```typescript
const totalEarnings = useMemo(() => {
  return activeEmployees.reduce((sum, employee) => {
    const summary = periodSummary.get(employee.id);
    if (summary && employee.hourly_rate) {
      const preOpeningMinutes = preOpeningByEmployee.get(employee.id) || 0;
      const realMinutes = Math.max(0, summary.total_minutes - preOpeningMinutes);
      return sum + (realMinutes / 60) * employee.hourly_rate;
    }
    return sum;
  }, 0);
}, [activeEmployees, periodSummary, preOpeningByEmployee]);
```

