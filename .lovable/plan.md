
# Centralny slownik uslug - ZAIMPLEMENTOWANY

## Rozwiazanie

Utworzono `src/hooks/useServiceDictionary.ts` - centralny hook React Query ladujacy **wszystkie** uslugi instancji (bez filtra `service_type`), eksponujacy `Map<id, ServiceData>` i helpery.

### Zmodyfikowane pliki:

1. ✅ **`src/hooks/useServiceDictionary.ts`** (NOWY) - centralny slownik
2. ✅ **`src/pages/AdminDashboard.tsx`** - uzywa `serviceDictMap` zamiast lokalnego `cachedServices` do budowy `servicesMap`, padding `pb-28`
3. ✅ **`src/pages/HallView.tsx`** - uzywa `serviceDictMap` w `servicesMap`, `servicesMapRef` i fetch
4. ✅ **`src/hooks/useReservations.ts`** - import `ServiceMapEntry` z dictionary
5. ✅ **`src/components/admin/history/ReservationHistoryDrawer.tsx`** - uzywa `useServiceDictionary` zamiast oddzielnego fetch
6. ✅ **`src/components/admin/NotificationsView.tsx`** - naprawiono fetch z legacy `services` na `unified_services` + fallback na `service_items` JSONB
7. ✅ **`src/components/admin/AddReservationDialogV2.tsx`** - wzbogacanie `service_items` o `name`/`short_name` przy tworzeniu nowych pozycji
8. ✅ **Padding mobilny** - `pb-20` → `pb-28` w AdminDashboard

### Klucz do rozwiazania:
- Jedno zapytanie SQL bez filtra `service_type` → pokrywa ALL typy (reservation, offer, both)
- `staleTime: 1h` → minimalne obciazenie bazy
- Slownik dostepny natychmiast po pierwszym zaladowaniu → brak race condition z Realtime
