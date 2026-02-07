# Analiza bugu wyświetlania archiwalnych rezerwacji

## Status: ✅ FAZA 1 ZAIMPLEMENTOWANA

## Symptomy zgłoszone przez użytkownika
- Cofnięcie do 24 stycznia (2 tyg wstecz) - brak rezerwacji
- Odświeżenie strony - pokazały się
- Przejście na 23 stycznia - znowu pusto
- Powrót na 24 - znowu pusto
- **138+ requestów do tabeli reservations** przy nawigacji

## Zidentyfikowane problemy w kodzie

### 1. Race condition w `loadMoreReservations` + `handleCalendarDateChange`
**NAPRAWIONE ✅** - Dodano mutex `isLoadingMoreRef` (useRef) do synchronicznej blokady wielokrotnych wywołań.

### 2. Brak debounce na `handleCalendarDateChange`
**NAPRAWIONE ✅** - Dodano 300ms debounce przez `loadMoreDebounceRef` z cleanup w useEffect.

### 3. useEffect w AdminCalendar wywołuje `onDateChange` zbyt często
**NAPRAWIONE ✅** - Użyto `onDateChangeRef` do stabilizacji callbacka i usunięto z dependencies.

### 4. Realtime retry wywołuje pełny `fetchReservations`
Do rozważenia w Fazie 2.

### 5. Brak cache dla starszych rezerwacji
Do rozważenia w Fazie 2 (migracja na React Query).

---

## Wprowadzone zmiany

### `src/pages/AdminDashboard.tsx`
1. Dodano `isLoadingMoreRef = useRef(false)` jako mutex
2. `loadMoreReservations` używa ref zamiast state do blokady
3. Dodano try/finally dla pewności zwolnienia mutex
4. Dodano `loadMoreDebounceRef` z 300ms debounce
5. Dodano cleanup effect dla debounce timeout

### `src/components/admin/AdminCalendar.tsx`
1. Dodano `onDateChangeRef = useRef(onDateChange)` 
2. useEffect używa tylko `currentDate` w dependencies (bez `onDateChange`)

---

## Faza 2: Optymalizacja (następny krok - opcjonalnie)

**2.1. Migracja na React Query**
- `queryKey: ['reservations', instanceId, { from, to }]`
- Automatyczne deduplication requestów
- `staleTime: 5 * 60 * 1000` (5 minut)

**2.2. Rate-limiting realtime retry**
- Dodać exponential backoff z max rate

**2.3. Windowed loading**
- Ładować tylko ±1 tydzień od aktualnej daty

---

## Testy do wykonania po naprawie:
1. ✅ Mobile: szybka nawigacja strzałkami wstecz o 3-4 tygodnie
2. ✅ Sprawdzić Network tab - max 2-3 requesty przy nawigacji
3. ✅ Włączyć flight mode → wyłączyć → sprawdzić czy dane się odświeżyły
4. ✅ Przejść do starej daty → odświeżyć stronę → sprawdzić rezerwacje
