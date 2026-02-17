
# Audyt: Wszystkie miejsca wyswietlania nazw uslug w aplikacji

## Znalezione lokalizacje (17 plikow)

Ponizej kompletna lista plikow i miejsc, gdzie system rozwiazuje lub wyswietla nazwy uslug. Kazde z tych miejsc potencjalnie moze wyswietlic "Usluga" zamiast prawdziwej nazwy, gdy cache (`cachedServices`) nie jest jeszcze zaladowany lub nie zawiera danej uslugi.

---

### 1. Zrodla danych (mapy/slowniki) - tu budowany jest cache

| Plik | Opis | Problem |
|------|------|---------|
| `src/hooks/useUnifiedServices.ts` | Hook React Query - laduje uslugi z filtrem `service_type IN ('reservation','both')` | Pomija uslugi typu `offer` - historia moze zawierac takie ID |
| `src/pages/AdminDashboard.tsx` (~L637-656) | Buduje `servicesMap` z `cachedServices` i zapisuje do `servicesMapRef` | Zalezy od momentu zaladowania cachedServices |
| `src/pages/HallView.tsx` (~L127-131, L776-779) | Buduje `servicesMap` (Map string->string) i `servicesMapRef` z `cachedServices` | Ten sam problem z timingiem |
| `src/hooks/useReservations.ts` (~L269-287) | Buduje wlasny `servicesMap` z `useUnifiedServices` i trzyma `servicesMapRef` | Trzecie niezalezne zrodlo |

### 2. Mapowanie nazw przy fetch/realtime (fallback "Usluga")

| Plik | Linie | Kontekst |
|------|-------|----------|
| **AdminDashboard.tsx** | ~L563, L582 | `mapReservationData()` - fallback `'Usługa'` |
| **AdminDashboard.tsx** | ~L1044, L1144 | Realtime INSERT/UPDATE handler - fallback `'Usługa'` |
| **HallView.tsx** | ~L324, L356, L375 | Inicjalny fetch i mapowanie serwisow - fallback `'Usługa'` |
| **HallView.tsx** | ~L652, L666, L817, L830 | Polling/Realtime handler - fallback `'Usługa'` |
| **HallView.tsx** | ~L1158, L1173, L1218 | Drawery edycji/podgladu - fallback `'Usługa'` |
| **useReservations.ts** | ~L183, L199 | `fetchReservations()` - fallback `'Usługa'` |

### 3. Wyswietlanie nazw na UI

| Plik | Kontekst | Co wyswietla |
|------|----------|--------------|
| **AdminCalendar.tsx** | Kafelki rezerwacji w kalendarzu (~L1681, L1698, L2296) | `svc.shortcut \|\| svc.name` |
| **ReservationsView.tsx** | Lista rezerwacji - pills (~L242) | `reservation.services_data` lub `reservation.service` |
| **ReservationDetailsDrawer.tsx** | Szuflada szczegolow - pills (~L755) | `reservation.services_data` lub `reservation.service.name` |
| **ReservationDetailsDrawer.tsx** | Dodawanie uslugi w drawerze (~L360) | Fallback `'Usługa'` przy tworzeniu nowego elementu |
| **HallReservationCard.tsx** | Karta rezerwacji w widoku hali (~L242) | `services_data.name` |
| **YardVehiclesList.tsx** | Lista pojazdow na placu (~L285) | `svc.shortcut \|\| svc.name` |
| **NotificationsView.tsx** | Powiadomienia (~L86) | Fetch z legacy tabeli `services` |

### 4. Historia rezerwacji

| Plik | Kontekst |
|------|----------|
| **ReservationHistoryDrawer.tsx** (~L58) | Laduje wlasna mape uslug (oddzielny fetch!) |
| **HistoryCreatedCard.tsx** (~L17) | `servicesMap.get(id) \|\| id` - wyswietla surowe UUID jesli brak w mapie |
| **HistoryTimelineItem.tsx** (~L33) | `formatServicesDiff()` - uzywa `servicesMap.get(id) \|\| id` |
| **reservationHistoryService.ts** (~L71, L74) | `formatServicesDiff()` / `formatEmployeesDiff()` - fallback na ID |

### 5. Oferty i formularz klienta

| Plik | Kontekst |
|------|----------|
| **OfferSelectionDialog.tsx** (~L99) | Fallback `'Usługa'` |
| **MojaRezerwacja.tsx** (~L362) | Wyswietla `reservation.service.name` (legacy single service) |
| **BookingForm.tsx** (~L75, L111) | `service.name` (formularz klienta) |
| **CustomerBookingWizard.tsx** (~L1185) | `service.name` (wizard klienta) |

### 6. Ustawienia/konfiguracja

| Plik | Kontekst |
|------|----------|
| **WidgetSettingsTab.tsx** (~L270) | `getServiceName()` - fallback `'Nieznana usługa'` |

---

## Analiza glownej przyczyny bugu

Mapa uslug jest budowana **niezaleznie w 4 miejscach** (AdminDashboard, HallView, useReservations, ReservationHistoryDrawer), kazde z wlasnym timingiem i filtrem. Gdy `cachedServices` z React Query nie zdazy sie zaladowac przed pierwszym renderem rezerwacji lub Realtime event, mapa jest pusta i fallback `'Usługa'` zostaje wyswietlony.

---

## Proponowane rozwiazanie: Centralny slownik uslug

### Nowy plik: `src/hooks/useServiceDictionary.ts`

- Jeden hook React Query ladujacy **wszystkie** uslugi instancji (bez filtra `service_type`)
- Eksponuje `Map<id, {name, short_name, ...}>` i helpery: `getServiceName(id)`, `getServiceShortName(id)`
- `staleTime: 1h`, inwalidacja przy mutacjach
- Uzyty we wszystkich 4 miejscach zamiast lokalnych map

### Pliki do modyfikacji:

1. **`useUnifiedServices.ts`** - dodac wariant "all" (bez filtra service_type) lub nowy hook
2. **`AdminDashboard.tsx`** - zamienic lokalne `servicesMap`/`servicesMapRef` na slownik
3. **`HallView.tsx`** - zamienic 3 lokalne mapy na slownik
4. **`useReservations.ts`** - zamienic lokalna mape na slownik
5. **`ReservationHistoryDrawer.tsx`** - uzyc slownika zamiast oddzielnego fetch
6. **`ReservationDetailsDrawer.tsx`** - uzyc slownika zamiast fallbacku
7. **`NotificationsView.tsx`** - uzyc slownika zamiast fetch z legacy tabeli
8. **`OfferSelectionDialog.tsx`** - uzyc slownika
9. **`AddReservationDialogV2.tsx`** - wzbogacic `service_items` o `name`/`short_name` przy zapisie

### Dodatkowe: Padding mobilny
- **`AdminDashboard.tsx`** - zwiekszyc `pb-20` do `pb-28`
- **`CustomersView.tsx`** / **`ReservationsView.tsx`** - sprawdzic i dodac dolny padding
