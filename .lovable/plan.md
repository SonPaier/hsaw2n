

# Audyt operacji backendowych - pełny raport

## Podsumowanie wykonawcze

Audyt zidentyfikował **12 głównych obszarów** wymagających optymalizacji. Większość problemów dotyczy:
- Duplikowanych zapytań do bazy danych (N+1)
- Brakującego cachowania dla rzadko zmienianych danych
- Błędów w RLS policy queries
- Niepotrzebnych operacji synchronicznych w FE

---

## 1. Błędy w bazie danych (KRYTYCZNE)

### Znalezione w logach Postgres:

Aktywnie występujące błędy SQL:
- `column offer_text_blocks.instance_id does not exist`
- `column offer_options.instance_id does not exist`  
- `column offer_option_items.instance_id does not exist`
- `column offer_history.instance_id does not exist`

**Przyczyna**: RLS policies próbują filtrować po `instance_id`, ale te tabele nie mają tej kolumny (używają relacji przez `offer_id`).

**Wpływ**: Każde zapytanie do tych tabel generuje błąd SQL, co spowalnia aplikację.

**Naprawa**: 
Modyfikacja RLS policies aby używały JOINa przez `offer_id`:
```sql
-- Zamiast:
instance_id = get_user_instance_id()

-- Powinno być:
offer_id IN (SELECT id FROM offers WHERE instance_id = get_user_instance_id())
```

---

## 2. Zduplikowane zapytania o services w fetchReservations (WYSOKIE)

**Lokalizacja**: `AdminDashboard.tsx` linie 592-618

**Problem**: Każde wywołanie `fetchReservations()` pobiera pełną listę `unified_services` od nowa, mimo że hook `useUnifiedServices` jest już dostępny i cachowany.

**Aktualny kod**:
```typescript
const fetchReservations = async () => {
  // PROBLEM: To pobiera services za każdym razem!
  const { data: servicesData } = await supabase
    .from('unified_services')
    .select('id, name, short_name, ...')
    .eq('instance_id', instanceId);
  // ...
}
```

**Rozwiązanie**: Użyć danych z hooka `useUnifiedServices`:
```typescript
// Hook już jest na górze:
const { data: cachedServices = [] } = useUnifiedServices(instanceId);

// W fetchReservations - tylko użyć cache:
const servicesMap = new Map(
  cachedServices.map(s => [s.id, { id: s.id, name: s.name, ... }])
);
servicesMapRef.current = servicesMap;
```

---

## 3. HallView - brak cachowania (WYSOKIE)

**Lokalizacja**: `HallView.tsx` linie 420-528

**Problem**: HallView nie używa żadnych hooków cachujących. Każde wejście do widoku hali pobiera:
- stations (już zcachowane w AdminDashboard, ale nie dzielone)
- working_hours
- unified_services
- reservations
- breaks
- yard_vehicles

**Rozwiązanie**: Użyć istniejących hooków:
```typescript
import { useStations } from '@/hooks/useStations';
import { useBreaks } from '@/hooks/useBreaks';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useUnifiedServices } from '@/hooks/useUnifiedServices';

// Zamiast manualnych fetchów:
const { data: stations = [] } = useStations(instanceId);
const { data: breaks = [] } = useBreaks(instanceId);
const { data: workingHours } = useWorkingHours(instanceId);
const { data: services = [] } = useUnifiedServices(instanceId);
```

---

## 4. Duplikowane zapytanie o user_roles (ŚREDNIE)

**Lokalizacja**: 
- `AdminDashboard.tsx` linie 316-363
- `HallView.tsx` linie 288-334

**Problem**: Oba komponenty pobierają `user_roles` w useEffect, ale `useAuth` już to robi przy logowaniu.

**Rozwiązanie**: Użyć danych z kontekstu auth:
```typescript
const { roles } = useAuth();
const adminRole = roles.find(r => r.role === 'admin' && r.instance_id);
const instanceId = adminRole?.instance_id;
```

---

## 5. OffersView - brakujący cache dla offer_scopes (ŚREDNIE)

**Lokalizacja**: `OffersView.tsx` linie 231-243

**Problem**: Przy każdym fetchOffers pobierane są scope_names osobno:
```typescript
const { data: scopesData } = await supabase
  .from('offer_scopes')
  .select('id, name')
  .in('id', scopeIds);
```

**Rozwiązanie**: Hook `useOfferScopes` został utworzony ale nie jest używany w OffersView.

---

## 6. Brak indeksów dla częstych zapytań (ŚREDNIE)

Na podstawie analizy zapytań, brakujące indeksy:

| Tabela | Kolumny | Używane w |
|--------|---------|-----------|
| reservations | (instance_id, reservation_date) | Calendar fetch |
| reservations | (instance_id, status) | Filtrowanie |
| offers | (instance_id, status) | Lista ofert |
| customer_vehicles | (instance_id, phone) | Autocomplete |
| notifications | (instance_id, read) | Badge count |

**SQL do dodania**:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_instance_date 
  ON reservations(instance_id, reservation_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_instance_status 
  ON reservations(instance_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_instance_status 
  ON offers(instance_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_vehicles_phone 
  ON customer_vehicles(instance_id, phone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread 
  ON notifications(instance_id, read) WHERE read = false;
```

---

## 7. Realtime fetch przy każdym UPDATE (NISKIE)

**Lokalizacja**: `AdminDashboard.tsx` linie 1002-1050, `HallView.tsx` linie 658-705

**Problem**: Przy każdym UPDATE z realtime, wykonywany jest pełny SELECT na rezerwacji:
```typescript
supabase.from('reservations')
  .select(`id, instance_id, customer_name, ...`)
  .eq('id', payload.new.id)
  .single()
```

**Optymalizacja**: Użyć `payload.new` bezpośrednio gdy to możliwe (dla prostych pól), a fetch tylko dla relacji:
```typescript
// Dane z payload.new są kompletne dla prostych kolumn
// Fetch tylko gdy potrzebujemy relacji (stations)
if (needsStationInfo && !payload.new.stations) {
  // fetch tylko stations
}
```

---

## 8. Operacje które mogą być asynchroniczne

### 8a. findCustomerEmail w ReservationDetailsDrawer

**Lokalizacja**: `ReservationDetailsDrawer.tsx` linie 259-287

**Problem**: Przy każdym otwarciu drawera wykonywane są 2 zapytania do znalezienia emaila:
```typescript
// Query 1: customers table
const { data: customer } = await supabase.from('customers')...

// Query 2: offers table (jeśli nie znaleziono)
const { data: offers } = await supabase.from('offers')...
```

**Optymalizacja**: 
1. Cache wyników (email rzadko się zmienia)
2. Wykonać tylko gdy user kliknie "Dodaj protokół"
3. Stworzyć funkcję DB do jednego zapytania

### 8b. fetchYardVehicleCount

**Lokalizacja**: `AdminDashboard.tsx` linie 377-387

Już zoptymalizowane - lazy loading przy otwarciu dialogu.

---

## 9. RLS Policy Performance (ŚREDNIE)

**Linter WARN**: "RLS Policy Always True"

Sprawdzić które policies używają `USING (true)` i czy są prawidłowe:
- Publiczne tabele: OK
- Prywatne tabele: wymaga naprawy

**Sprawdzenie**:
```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE qual LIKE '%true%';
```

---

## 10. Promise.all - dobra praktyka, już używana ✅

Znaleziono 9 miejsc z `Promise.all`:
- `useAuth.tsx` - roles + profile
- `CustomersView.tsx` - customers + vehicles  
- `ReservationHistoryDrawer.tsx` - history + services + stations
- `ServiceSelectionDrawer.tsx` - services + categories
- `ProductsView.tsx` - priceLists + products + categoryOrder

**Status**: OK, to jest poprawne podejście.

---

## 11. SELECT * vs SELECT columns (NISKIE)

**Lokalizacja**: `useInstanceData.ts` linia 9

```typescript
.select('*')  // ❌ Pobiera wszystkie kolumny
```

Dla tabeli `instances` to ~30 kolumn, ale używamy tylko kilka.

**Optymalizacja**: Wybrać tylko potrzebne kolumny:
```typescript
.select('id, name, short_name, working_hours, slug, reservation_phone, timezone, logo_url')
```

---

## 12. Memory leaks - event listeners (NISKIE)

**Sprawdzenie**: Wszystkie realtime subscriptions mają cleanup w `return () => {...}` ✅

Brak wykrytych memory leaków z event listenerów.

---

## Priorytetowa lista napraw

### KRYTYCZNE (zrobić natychmiast):
1. ✅ **Naprawić RLS policies** dla offer_text_blocks, offer_options, offer_option_items, offer_history
   - Utworzono funkcje `get_offer_instance_id()` i `get_option_instance_id()` 
   - Nowe polityki używają JOIN przez offer_id zamiast nieistniejącej kolumny instance_id
2. ✅ **Usunąć duplicate services fetch** z fetchReservations w AdminDashboard
   - Teraz używa `cachedServices` z hooka `useUnifiedServices`

### WYSOKIE (ten sprint):
3. ✅ **Użyć hooków cachujących w HallView** (useStations, useBreaks, etc.)
   - Dodano `useBreaks`, `useWorkingHours`, `useUnifiedServices`
   - Usunięto duplicate fetch user_roles - używa roles z useAuth
4. ✅ **Dodać brakujące indeksy** na reservations, offers, customer_vehicles
   - `idx_reservations_instance_date`, `idx_reservations_instance_status`
   - `idx_offers_instance_status`, `idx_customer_vehicles_instance_phone`
   - `idx_notifications_instance_unread`

### ŚREDNIE (następny sprint):
5. ✅ Użyć roles z useAuth zamiast duplicate fetch w AdminDashboard/HallView
6. ✅ Użyć useOfferScopes w OffersView
7. Sprawdzić i naprawić permissive RLS policies (ostrzeżenia lintera - istniejące)

### NISKIE (backlog):
8. Zoptymalizować realtime UPDATE handler
9. Cache dla findCustomerEmail
10. SELECT tylko potrzebnych kolumn w useInstanceData

---

## Metryki do monitorowania

Po wdrożeniu zmian monitorować:
- Liczba zapytań SQL na load kalendarza (cel: <10)
- Czas odpowiedzi API (cel: <200ms p95)
- Błędy w Postgres logs (cel: 0 dla RLS)
- Realtime reconnection rate

