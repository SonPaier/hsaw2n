
# Plan: Naprawa błędu FK constraint dla unified_services

## Problem
Kolumna `reservations.service_id` ma Foreign Key constraint do starej tabeli `services`, ale aplikacja używa teraz `unified_services`. Próba zapisu rezerwacji z nową usługą powoduje błąd 409 Conflict.

## Rozwiązanie

### 1. Migracja bazy danych
Usunięcie starego FK constraint:
```sql
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_service_id_fkey;

COMMENT ON COLUMN public.reservations.service_id IS 
  'Legacy: dla starych rezerwacji. Nowe (has_unified_services=true) używają service_ids array';
```

### 2. Aktualizacja frontendu
**Plik: `src/components/admin/AddReservationDialogV2.tsx`**

Zmiana w **UPDATE** (linia ~1093):
```typescript
// Przed:
service_id: selectedServices[0],

// Po:
service_id: editingReservation.has_unified_services ? null : selectedServices[0],
```

Zmiana w **INSERT** (linia ~1133):
```typescript
// Przed:
service_id: selectedServices[0],

// Po:
service_id: null,
```

### 3. Aktualizacja Edge Functions

**Plik: `supabase/functions/create-reservation-direct/index.ts`** (linia ~155)
```typescript
// Przed:
service_id: reservationData.serviceId,

// Po:
service_id: null,
service_ids: [reservationData.serviceId],
has_unified_services: true,
```

**Plik: `supabase/functions/verify-sms-code/index.ts`** (linia ~170)
```typescript
// Przed:
service_id: reservationData.serviceId,

// Po:
service_id: null,
service_ids: [reservationData.serviceId],
has_unified_services: true,
```

## Szczegóły techniczne

### Pliki do edycji
| Plik | Zmiana |
|------|--------|
| Migracja SQL | Usunięcie `reservations_service_id_fkey` |
| `AddReservationDialogV2.tsx` | `service_id: null` dla nowych, warunkowe dla edycji |
| `create-reservation-direct/index.ts` | `service_id: null`, dodanie `service_ids` i `has_unified_services` |
| `verify-sms-code/index.ts` | Analogiczna zmiana jak wyżej |

### Dlaczego to bezpieczne
- Stare rezerwacje zachowają swoje `service_id` - bez zmian
- Nowe rezerwacje używają `service_ids` (JSONB array) i `service_items` (snapshot)
- Flaga `has_unified_services` pozwala rozróżnić stary i nowy model
- Edycja starych rezerwacji (`has_unified_services = false`) zachowuje kompatybilność

### Efekt po naprawie
- Błąd 409 przestanie występować
- Nowe rezerwacje: `service_id: null`, dane w `service_ids`
- Stare rezerwacje: bez zmian, `service_id` wskazuje na `services`
