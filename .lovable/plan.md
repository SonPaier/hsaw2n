# Analiza bugu wyświetlania archiwalnych rezerwacji

## Status: ✅ FAZA 1 ZAIMPLEMENTOWANA | ⏳ FAZA 2 W TOKU

## Symptomy zgłoszone przez użytkownika
- Cofnięcie do 24 stycznia (2 tyg wstecz) - brak rezerwacji
- Odświeżenie strony - pokazały się
- Przejście na 23 stycznia - znowu pusto
- Powrót na 24 - znowu pusto
- **138+ requestów do tabeli reservations** przy nawigacji

---

## ✅ Faza 1: Stabilizacja (ZAIMPLEMENTOWANA)

### Zmiany w `src/pages/AdminDashboard.tsx`:
1. ✅ Mutex `isLoadingMoreRef` (useRef) - synchroniczna blokada
2. ✅ Try/finally w `loadMoreReservations` - pewność zwolnienia mutex
3. ✅ Debounce 300ms przez `loadMoreDebounceRef`
4. ✅ Cleanup effect dla debounce timeout

### Zmiany w `src/components/admin/AdminCalendar.tsx`:
1. ✅ `onDateChangeRef` - stabilizacja callbacka
2. ✅ useEffect bez `onDateChange` w dependencies

### Wynik testów:
- ✅ 5 szybkich kliknięć wstecz = **1 request do reservations** (zamiast 138+)
- ✅ Debounce i mutex działają poprawnie

---

## ⏳ Faza 2: Optymalizacja (W TOKU)

### Utworzone pliki:

#### `src/hooks/useReservations.ts`
Hook React Query z:
- `staleTime: 5 * 60 * 1000` (5 minut)
- `gcTime: 10 * 60 * 1000` (10 minut)
- Automatyczne ładowanie starszych rezerwacji (`loadMoreReservations`)
- Cache management (`updateReservationInCache`, `removeReservationFromCache`)
- Windowed loading z buffer 7 dni

#### `src/hooks/useReservationsRealtime.ts`
Hook do realtime z rate-limiting:
- `maxRetries: 5`
- `baseDelay: 1000ms`, `maxDelay: 30000ms`
- `minRefetchInterval: 10000ms` (10s między pełnymi refetchami)
- Exponential backoff (multiplier 1.5)
- Debounce dla lokalnych zmian

### Pozostało do zrobienia:
- [ ] Integracja `useReservations` z AdminDashboard
- [ ] Usunięcie starego kodu `fetchReservations`, `loadMoreReservations`
- [ ] Migracja realtime logic do `useReservationsRealtime`
- [ ] Testy pełnej integracji

---

## Testy do wykonania po pełnej integracji:
1. Mobile: szybka nawigacja strzałkami wstecz o 3-4 tygodnie
2. Network tab - max 2-3 requesty przy nawigacji
3. Flight mode → wyłączenie → sprawdzenie czy dane się odświeżyły
4. Stara data → odświeżenie strony → weryfikacja rezerwacji
5. Realtime: zmiana statusu rezerwacji z drugiego urządzenia
