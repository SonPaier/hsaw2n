
# Plan testów backendowych dla logiki rezerwacji

## Status implementacji: ✅ ZAKOŃCZONO

**Data:** 2026-01-23  
**Frontend (Vitest):** 255 testów ✅  
**Backend (Deno):** 107 testów ✅  
**E2E (Playwright):** 6 testów ✅  
**Razem:** 368 testów

---

## E2E Tests (Playwright)

Lokalizacja: `e2e/reservation-flow.spec.ts`  
Helpery: `e2e/fixtures/e2e-helpers.ts`

| ID | Test | Status |
|---|---|---|
| RF-E2E-001 | Admin dodaje rezerwację i widzi ją na kalendarzu | ✅ |
| RF-E2E-002 | Admin widzi rezerwacje z seed-a | ✅ |
| RF-E2E-003 | Admin otwiera i widzi szczegóły rezerwacji | ✅ |
| RF-E2E-004 | Admin edytuje rezerwację | ✅ |
| RF-E2E-005 | Admin zmienia status rezerwacji | ✅ |
| RF-E2E-006 | Sesja admina jest zachowana po odświeżeniu | ✅ |

### E2E Helpers (reusable utils)

```typescript
// Authentication
loginAsAdmin(page)          // Login do instancji E2E

// Reservation CRUD
openAddReservationDialog(page)
fillReservationForm(page, data)
selectFirstService(page)
saveReservation(page)
waitForSuccessToast(page)

// Reservation Details
openReservationDetails(page, customerName)
verifyReservationDetails(page, expected)
clickEditReservation(page)
closeReservationDetails(page)
changeReservationStatus(page, action)
updateReservationField(page, field, value)

// Calendar
verifyReservationOnCalendar(page, customerName)

// Seeding
seedE2EReset()              // Czyści dane instancji E2E
seedE2EScenario(scenario)   // 'basic' | 'with_reservations' | 'with_offers' | 'full'
```

---

## Zaimplementowane testy backendowe

### 1. Phone Utils (36 testów) ✅
Plik: `supabase/functions/_shared/phoneUtils_test.ts`

- PHU-001 - PHU-036: Normalizacja numerów telefonów
- Obsługa formatów polskich, niemieckich, ukraińskich, czeskich
- Usuwanie trunk zero, podwójnych prefiksów, spacji
- Fallback dla nieprawidłowych numerów
- Edge cases: retry z +, catch block, unknown formats

### 2. Reservation Utils (39 testów) ✅
Plik: `supabase/functions/_shared/reservationUtils_test.ts`

- CRD-007: Obliczanie end_time (z overflow na północ)
- CRD-008: Generowanie 7-cyfrowych kodów potwierdzenia
- CRD-015/016: Formatowanie SMS dla confirmed/pending
- CRD-017-019: Linki do edycji i Google Maps w SMS
- CRD-002: Walidacja requestów
- CRD-023: Parsowanie modeli aut (w tym pusty string)
- SSC-001/002/004: Kody weryfikacyjne i SMS
- VSC-002: Walidacja weryfikacji SMS
- Wszystkie dni tygodnia i miesiące

### 3. Reminder Utils (32 testy) ✅
Plik: `supabase/functions/_shared/reminderUtils_test.ts`

- SRE-002: Konwersja timezone (Europe/Warsaw, UTC, DST)
- SRE-003: Detekcja "jutro" z uwzględnieniem timezone
- SRE-004: Obliczanie minut do rozpoczęcia rezerwacji
- SRE-006: Logika backoff (15 minut) + boundary cases
- SRE-008: Próg trwałych awarii (default threshold)
- SRE-009: Okno czasowe wysyłania (±5 minut) + edges
- SRE-MSG: Formatowanie wiadomości SMS (null editUrl)

---

## Poprawki w kodzie produkcyjnym

### 1. Bug w phoneUtils.ts (naprawiony)
**Problem:** Trunk zero removal usuwało pierwszy znak z prefiksów 3-cyfrowych (np. +380 → +38)

**Rozwiązanie:** Ograniczenie regex do znanych krajów z trunk zero:
```typescript
// Przed:
fallback.replace(/^(\+\d{1,3})0(\d)/, "$1$2")

// Po:
fallback.replace(/^(\+(?:49|43|41|39))0(\d)/, "$1$2")
```

---

## Podsumowanie pokrycia

| Moduł | Testy | Status |
|-------|-------|--------|
| phoneUtils | 36 | ✅ |
| reservationUtils | 39 | ✅ |
| reminderUtils | 32 | ✅ |
| **Backend razem** | **107** | ✅ |

### E2E (Playwright)

| Flow | Testy | Status |
|------|-------|--------|
| Reservation CRUD | 6 | ✅ |

### Frontend (Vitest)

| Komponent | Testy | Status |
|-----------|-------|--------|
| ReservationDetailsDrawer | 81 | ✅ |
| AddReservationDialogV2 | 46 | ✅ |
| SelectedServicesList | 22 | ✅ |
| CarSearchAutocomplete | 22 | ✅ |
| PhoneMaskedInput | 23 | ✅ |
| phoneUtils (frontend) | 24 | ✅ |
| InstanceAuth | 19 | ✅ |
| ServiceSelectionDrawer | 12 | ✅ |
| ClientSearchAutocomplete | 6 | ✅ |
| **Frontend razem** | **255** | ✅ |

---

## Architektura testów

```text
e2e/
├── reservation-flow.spec.ts   # 6 testów E2E
└── fixtures/
    └── e2e-helpers.ts         # Reusable utils (login, seed, CRUD)

supabase/functions/_shared/
├── phoneUtils.ts              # Normalizacja telefonów
├── phoneUtils_test.ts         # 36 testów
├── reservationUtils.ts        # Logika rezerwacji
├── reservationUtils_test.ts   # 39 testów
├── reminderUtils.ts           # Logika przypomnień
├── reminderUtils_test.ts      # 32 testy
└── sentry.ts                  # Error tracking
```
