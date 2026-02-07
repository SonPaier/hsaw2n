
# Analiza bugu wyświetlania archiwalnych rezerwacji

## Symptomy zgłoszone przez użytkownika
- Cofnięcie do 24 stycznia (2 tyg wstecz) - brak rezerwacji
- Odświeżenie strony - pokazały się
- Przejście na 23 stycznia - znowu pusto
- Powrót na 24 - znowu pusto
- **138+ requestów do tabeli reservations** przy nawigacji

## Zidentyfikowane problemy w kodzie

### 1. Race condition w `loadMoreReservations` + `handleCalendarDateChange`

```text
handleCalendarDateChange(date)
    ↓
setCalendarDate(date)  ← wywołuje useEffect w AdminCalendar (onDateChange)
    ↓
Sprawdza: date < loadedDateRange.from + 7 dni?
    ↓
loadMoreReservations('past')
    ↓
setIsLoadingMoreReservations(true)  ← ale check jest: if (isLoadingMoreReservations) return
    ↓
PROBLEM: Stan async, wielokrotne wywołania mogą przejść zanim state się zaktualizuje
```

**Linia 710-711:** Warunek `if (!instanceId || isLoadingMoreReservations) return` używa stanu, który w React nie jest natychmiastowy - jeśli użytkownik szybko nawiguje (np. strzałkami), wiele wywołań może przejść zanim `isLoadingMoreReservations` stanie się `true`.

### 2. Brak debounce na `handleCalendarDateChange`

Każda zmiana daty w kalendarzu natychmiast odpala callback. Na mobile, gdzie scroll jest szybki, może to generować dziesiątki wywołań.

**Linia 785-793:** 
```javascript
const handleCalendarDateChange = useCallback((date: Date) => {
  setCalendarDate(date);
  // Check if approaching edge - triggers loadMore
  if (date < addDays(loadedDateRange.from, bufferDays)) {
    loadMoreReservations('past');
  }
}, [loadedDateRange.from, loadMoreReservations]);
```

### 3. useEffect w AdminCalendar wywołuje `onDateChange` zbyt często

**Linia 293-295 w AdminCalendar.tsx:**
```javascript
useEffect(() => {
  onDateChange?.(currentDate);
}, [currentDate, onDateChange]);
```

Problem: `onDateChange` jest w dependencies, ale `handleCalendarDateChange` tworzy się na nowo przy każdej zmianie `loadedDateRange.from`. To może powodować dodatkowe wywołania.

### 4. Realtime retry wywołuje pełny `fetchReservations`

**Linia 1135:** Przy rozłączeniu WebSocket (co zdarza się często na mobile), retry wywołuje `fetchReservations()` bez żadnego rate-limiting:
```javascript
retryTimeoutId = setTimeout(() => {
  fetchReservations();  // ← Pełny fetch wszystkiego
  setupRealtimeChannel();
}, delay);
```

### 5. Brak cache dla starszych rezerwacji

Każde przejście do starszych dat odpala nowy request do bazy. Nie ma mechanizmu cache'owania już pobranych rezerwacji - `loadMoreReservations` dopisuje do stanu, ale jeśli komponent się odmontuje i zamontuje ponownie (np. zmiana widoku), wszystko jest fetchowane od nowa.

### 6. Potencjalny problem z pustym stanem

Gdy `loadMoreReservations` jest w trakcie, a użytkownik nawiguje dalej w przeszłość, nowe rezerwacje są dopisywane na początku tablicy (`[...mappedData, ...prev]`), ale filtrowanie na konkretny dzień w kalendarzu może pokazywać pusty wynik zanim dane się załadują.

---

## Plan naprawy

### Faza 1: Stabilizacja (natychmiastowe poprawki)

**1.1. Dodać mutex do `loadMoreReservations`**
Użyć `useRef` zamiast `useState` dla flagi loading, co eliminuje race condition:

```typescript
const isLoadingMoreRef = useRef(false);

const loadMoreReservations = useCallback(async (direction: 'past') => {
  if (!instanceId || isLoadingMoreRef.current) return;
  isLoadingMoreRef.current = true;
  setIsLoadingMoreReservations(true); // dla UI
  
  try {
    // ... fetch logic
  } finally {
    isLoadingMoreRef.current = false;
    setIsLoadingMoreReservations(false);
  }
}, [...]);
```

**1.2. Debounce na `handleCalendarDateChange`**
Dodać 300ms debounce, żeby szybka nawigacja nie generowała wielu requestów:

```typescript
const loadMoreReservationsDebounced = useMemo(
  () => debounce(() => loadMoreReservations('past'), 300),
  [loadMoreReservations]
);
```

**1.3. Stabilizacja `onDateChange` w AdminCalendar**
Usunąć `onDateChange` z dependencies useEffect lub użyć `useRef`:

```typescript
const onDateChangeRef = useRef(onDateChange);
onDateChangeRef.current = onDateChange;

useEffect(() => {
  onDateChangeRef.current?.(currentDate);
}, [currentDate]); // tylko currentDate w dependencies
```

### Faza 2: Optymalizacja (następny krok)

**2.1. Migracja na React Query**
Zamiast manualnego stanu `reservations`, użyć React Query z:
- `staleTime: 5 * 60 * 1000` (5 minut)
- `queryKey: ['reservations', instanceId, { from, to }]`
- Automatyczne deduplication requestów

**2.2. Windowed loading**
Zamiast ładować "wszystko od daty X", ładować tylko ±1 tydzień od aktualnej daty kalendarza. To zmniejszy payload i czas ładowania.

**2.3. Optimistic UI dla nawigacji**
Pokazywać skeleton/loading indicator dla dni bez danych zamiast pustego kalendarza.

---

## Diagram przepływu problemu

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     CURRENT (BUGGY) FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User: Navigate to Jan 24                                           │
│         ↓                                                           │
│  AdminCalendar: setCurrentDate → triggers useEffect                 │
│         ↓                                                           │
│  useEffect calls onDateChange(date)                                 │
│         ↓                                                           │
│  handleCalendarDateChange checks: date < from + 7?                  │
│         ↓ YES                                                       │
│  loadMoreReservations('past')                                       │
│         ↓                                                           │
│  if (isLoadingMoreReservations) return  ← STATE NOT YET TRUE!       │
│         ↓ PASSES                                                    │
│  User navigates again before state updates                          │
│         ↓                                                           │
│  ANOTHER loadMoreReservations call                                  │
│         ↓                                                           │
│  RACE CONDITION: Multiple fetches in parallel                       │
│         ↓                                                           │
│  WebSocket disconnect (mobile)                                      │
│         ↓                                                           │
│  Retry logic triggers MORE fetchReservations                        │
│         ↓                                                           │
│  138+ requests to reservations table                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Szczegóły techniczne implementacji

### Pliki do zmodyfikowania:

| Plik | Zmiany |
|------|--------|
| `src/pages/AdminDashboard.tsx` | Mutex ref, debounce, stabilizacja callbacków |
| `src/components/admin/AdminCalendar.tsx` | useRef dla onDateChange |

### Estymacja:
- Faza 1 (stabilizacja): ~30 min
- Faza 2 (React Query): ~2-3 godz

### Testy do wykonania po naprawie:
1. Mobile: szybka nawigacja strzałkami wstecz o 3-4 tygodnie
2. Sprawdzić Network tab - max 2-3 requesty przy nawigacji
3. Włączyć flight mode → wyłączyć → sprawdzić czy dane się odświeżyły poprawnie
4. Przejść do starej daty → odświeżyć stronę → sprawdzić czy rezerwacje są widoczne
