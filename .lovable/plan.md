
# Plan testów backendowych dla logiki rezerwacji

## Status implementacji: ✅ ZAKOŃCZONO

**Data:** 2026-01-23  
**Frontend:** 255 testów ✅  
**Backend (Deno):** 79 testów ✅  
**Razem:** 334 testy jednostkowe

---

## Zaimplementowane testy backendowe

### 1. Phone Utils (25 testów) ✅
Plik: `supabase/functions/_shared/phoneUtils_test.ts`

- PHU-001 - PHU-025: Normalizacja numerów telefonów
- Obsługa formatów polskich, niemieckich, ukraińskich, czeskich
- Usuwanie trunk zero, podwójnych prefiksów, spacji
- Fallback dla nieprawidłowych numerów

### 2. Reservation Utils (31 testów) ✅
Plik: `supabase/functions/_shared/reservationUtils_test.ts`

- CRD-007: Obliczanie end_time (z overflow na północ)
- CRD-008: Generowanie 7-cyfrowych kodów potwierdzenia
- CRD-015/016: Formatowanie SMS dla confirmed/pending
- CRD-017-019: Linki do edycji i Google Maps w SMS
- CRD-002: Walidacja requestów
- CRD-023: Parsowanie modeli aut
- SSC-001/002/004: Kody weryfikacyjne i SMS
- VSC-002: Walidacja weryfikacji SMS

### 3. Reminder Utils (23 testy) ✅
Plik: `supabase/functions/_shared/reminderUtils_test.ts`

- SRE-002: Konwersja timezone (Europe/Warsaw)
- SRE-003: Detekcja "jutro" z uwzględnieniem timezone
- SRE-004: Obliczanie minut do rozpoczęcia rezerwacji
- SRE-006: Logika backoff (15 minut)
- SRE-008: Próg trwałych awarii
- SRE-009: Okno czasowe wysyłania (±5 minut)
- SRE-MSG: Formatowanie wiadomości SMS dla 1-day i 1-hour

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

## Architektura testów

```text
supabase/functions/_shared/
├── phoneUtils.ts          # Normalizacja telefonów (libphonenumber-js)
├── phoneUtils_test.ts     # 25 testów
├── reservationUtils.ts    # Logika rezerwacji (pure functions)
├── reservationUtils_test.ts # 31 testów
├── reminderUtils.ts       # Logika przypomnień (timezone, backoff)
├── reminderUtils_test.ts  # 23 testy
└── sentry.ts              # Error tracking
```

---

## Podsumowanie pokrycia

| Moduł | Testy | Status |
|-------|-------|--------|
| phoneUtils | 25/25 | ✅ |
| reservationUtils | 31/31 | ✅ |
| reminderUtils | 23/23 | ✅ |
| **Backend razem** | **79** | ✅ |

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

## Następne kroki (opcjonalne)

1. **Integration tests dla RPC functions** - testy na prawdziwej bazie:
   - `cancel_reservation_by_code`
   - `request_reservation_change_by_code`
   - `claim_reminder_1day/1hour`

2. **E2E tests dla edge case'ów** - Playwright:
   - Zmiana terminu przez klienta
   - Anulowanie z powiadomienie
   - Multi-day reservations

3. **HTTP handler tests** - mockowanie pełnych requestów:
   - CORS preflight
   - Error responses
   - Supabase client mocking
