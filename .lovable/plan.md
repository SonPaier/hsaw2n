
# Plan testów backendowych dla logiki rezerwacji

## Analiza aktualnej architektury

System rezerwacji składa się z:

1. **Edge Functions (Supabase):**
   - `create-reservation-direct` - tworzenie rezerwacji dla zweryfikowanych klientów
   - `verify-sms-code` - weryfikacja kodu SMS i tworzenie rezerwacji
   - `send-sms-code` - wysyłanie kodu weryfikacyjnego SMS
   - `send-reminders` - automatyczne przypomnienia (1 dzień, 1 godzina przed)
   - `send-sms-message` - wysyłanie pojedynczych SMS

2. **Database Functions (RPC):**
   - `cancel_reservation_by_code` - anulowanie rezerwacji przez klienta
   - `request_reservation_change_by_code` - prośba o zmianę terminu
   - `upsert_customer_vehicle` - zapisywanie pojazdów klienta
   - `get_availability_blocks` - sprawdzanie dostępności slotów
   - `claim_reminder_1day` / `claim_reminder_1hour` - atomowe claimy dla przypomnień

3. **Database Triggers:**
   - `log_reservation_created` - logowanie utworzenia rezerwacji
   - `log_reservation_updated` - logowanie zmian rezerwacji
   - `reset_reminder_flags` - resetowanie flag przypomnień przy zmianie daty/godziny

4. **Frontend (Admin):**
   - `AddReservationDialogV2.tsx` - tworzenie/edycja rezerwacji przez admina
   - Direct Supabase calls dla zmian statusu (start/end/release/cancel/confirm)

---

## Strategia testowania

### Podział na warstwy:

```text
┌─────────────────────────────────────────────────────────────┐
│  DENO UNIT TESTS (Edge Functions)                           │
│  - Mockowanie Supabase client                               │
│  - Mockowanie SMSAPI (fetch)                                │
│  - Testowanie logiki bez I/O                                │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  INTEGRATION TESTS (Database Functions)                     │
│  - Testowanie RPC na prawdziwej bazie (seed → test → clean) │
│  - Używanie seed-e2e-scenario/seed-e2e-reset                │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  E2E TESTS (Playwright - już istniejące)                    │
│  - Full flow przez UI                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Szczegółowa lista przypadków testowych

### A. Edge Function: `create-reservation-direct`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| CRD-001 | CORS preflight | Unit | Odpowiedź na OPTIONS |
| CRD-002 | Brak wymaganych pól | Unit | Błąd 400 gdy brak instanceId/phone/reservationData |
| CRD-003 | Normalizacja telefonu | Unit | `733 854 184` → `+48733854184` |
| CRD-004 | Klient nie istnieje | Unit | Błąd 400 z `requiresVerification: true` |
| CRD-005 | Klient niezweryfikowany | Unit | Błąd 400 z `requiresVerification: true` |
| CRD-006 | Klient zweryfikowany - sukces | Unit | Tworzenie rezerwacji, kod potwierdzenia |
| CRD-007 | Obliczanie end_time | Unit | start=09:00, duration=90min → end=10:30 |
| CRD-008 | Generowanie unikalnego kodu | Unit | 7-cyfrowy kod, sprawdzenie unikalności |
| CRD-009 | Auto-confirm enabled | Unit | Status = "confirmed" |
| CRD-010 | Auto-confirm disabled | Unit | Status = "pending" |
| CRD-011 | Tworzenie notyfikacji | Unit | Insert do tabeli notifications |
| CRD-012 | Push notification wysyłany | Unit | Wywołanie send-push-notification |
| CRD-013 | Upsert customer vehicle | Unit | RPC upsert_customer_vehicle |
| CRD-014 | Aktualizacja nazwy klienta | Unit | Update gdy name się zmienił |
| CRD-015 | SMS - auto-confirm message | Unit | Treść SMS "Rezerwacja potwierdzona!" |
| CRD-016 | SMS - pending message | Unit | Treść SMS "Otrzymalismy prosbe..." |
| CRD-017 | SMS - edit link included | Unit | Gdy feature sms_edit_link enabled |
| CRD-018 | SMS - edit link excluded | Unit | Gdy feature disabled |
| CRD-019 | SMS - Google Maps link | Unit | Gdy google_maps_url ustawiony |
| CRD-020 | SMS logging (sent) | Unit | Insert do sms_logs status='sent' |
| CRD-021 | SMS logging (failed) | Unit | Insert do sms_logs status='failed' |
| CRD-022 | SMS logging (simulated) | Unit | Gdy brak SMSAPI_TOKEN |
| CRD-023 | Car model proposal | Unit | Insert do car_models status='proposal' |
| CRD-024 | Błąd DB przy insert | Unit | Zwrot 500 z komunikatem |
| CRD-025 | Sentry capture exception | Unit | Logowanie błędów krytycznych |

### B. Edge Function: `verify-sms-code`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| VSC-001 | CORS preflight | Unit | Odpowiedź na OPTIONS |
| VSC-002 | Brak wymaganych pól | Unit | Błąd 400 |
| VSC-003 | Kod nieważny | Unit | Błąd 400 "Invalid or expired code" |
| VSC-004 | Kod wygasły | Unit | Błąd 400 gdy expires_at < now() |
| VSC-005 | Kod już użyty | Unit | Błąd 400 gdy verified=true |
| VSC-006 | Kod poprawny - sukces | Unit | Tworzenie rezerwacji |
| VSC-007 | Tworzenie nowego klienta | Unit | Insert gdy nie istnieje |
| VSC-008 | Aktualizacja istniejącego klienta | Unit | Update phone_verified=true |
| VSC-009 | Obliczanie end_time | Unit | Na podstawie service.duration_minutes |
| VSC-010 | SMS confirmation | Unit | Wysyłanie SMS potwierdzenia |

### C. Edge Function: `send-sms-code`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| SSC-001 | Generowanie 4-cyfrowego kodu | Unit | Random 1000-9999 |
| SSC-002 | Zapis do sms_verification_codes | Unit | Insert z reservation_data |
| SSC-003 | Expires at = +24h | Unit | Prawidłowy czas wygaśnięcia |
| SSC-004 | SMS wysyłany | Unit | Wywołanie SMSAPI |
| SSC-005 | DEV MODE (brak tokena) | Unit | Zwrot devCode w response |
| SSC-006 | Increment SMS usage | Unit | RPC increment_sms_usage |
| SSC-007 | SMS limit warning (log only) | Unit | Logowanie gdy limit przekroczony |

### D. Edge Function: `send-reminders`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| SRE-001 | Brak SMSAPI_TOKEN | Unit | Skip z logiem |
| SRE-002 | Timezone calculation | Unit | Europe/Warsaw poprawnie |
| SRE-003 | Tomorrow detection | Unit | Rezerwacja na jutro → 1-day reminder |
| SRE-004 | 1-hour window | Unit | Rezerwacja za 45-75min → 1-hour reminder |
| SRE-005 | Atomic claim - success | Unit | claimReservationFor1DayReminder zwraca true |
| SRE-006 | Atomic claim - already claimed | Unit | Skip gdy claimed_at < backoff |
| SRE-007 | Permanent failure handling | Unit | Skip gdy reminder_permanent_failure=true |
| SRE-008 | Failure count increment | Unit | Zwiększanie przy błędzie SMS |
| SRE-009 | Send time window (5 min) | Unit | Wysyłanie tylko w oknie ±5 min |
| SRE-010 | Instance settings respect | Unit | Skip gdy reminder disabled |

### E. Database Function: `cancel_reservation_by_code`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| CRB-001 | Poprawny kod - sukces | Integration | Status → 'cancelled', zwrot true |
| CRB-002 | Nieistniejący kod | Integration | Zwrot false |
| CRB-003 | Już anulowana | Integration | Zwrot false (status='cancelled') |
| CRB-004 | Completed | Integration | Zwrot false (nie można anulować) |
| CRB-005 | Notyfikacja tworzona | Integration | Insert do notifications |
| CRB-006 | cancelled_at timestamp | Integration | Ustawiony na now() |

### F. Database Function: `request_reservation_change_by_code`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| RRC-001 | Poprawna prośba - sukces | Integration | Nowa rezerwacja status='change_requested' |
| RRC-002 | Kod nie istnieje | Integration | Exception 'RESERVATION_NOT_FOUND' |
| RRC-003 | Rezerwacja cancelled | Integration | Exception 'RESERVATION_NOT_EDITABLE' |
| RRC-004 | Cutoff time passed | Integration | Exception 'EDIT_CUTOFF_PASSED' |
| RRC-005 | Pending change exists | Integration | Exception 'ALREADY_HAS_PENDING_CHANGE' |
| RRC-006 | Service not found | Integration | Exception 'SERVICE_NOT_FOUND' |
| RRC-007 | Duration by car_size | Integration | Poprawny czas dla S/M/L |
| RRC-008 | Original reservation untouched | Integration | Oryginał bez zmian |
| RRC-009 | Confirmation code unique | Integration | Nowy 7-cyfrowy kod |
| RRC-010 | Notification created | Integration | Insert do notifications |

### G. Database Trigger: `log_reservation_created`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| LRC-001 | Insert loguje do reservation_changes | Integration | change_type='created' |
| LRC-002 | Batch ID generowany | Integration | gen_random_uuid() |
| LRC-003 | changed_by_type = customer (online) | Integration | Gdy source='online' |
| LRC-004 | changed_by_type = admin | Integration | Gdy source='admin' |
| LRC-005 | Wszystkie pola w new_value | Integration | service_ids, dates, times, etc. |

### H. Database Trigger: `log_reservation_updated`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| LRU-001 | Zmiana service_ids | Integration | Log z old/new value |
| LRU-002 | Zmiana dates | Integration | reservation_date + end_date jako jedno pole |
| LRU-003 | Zmiana times | Integration | start_time + end_time jako jedno pole |
| LRU-004 | Zmiana station_id | Integration | Log zmiany stanowiska |
| LRU-005 | Zmiana price | Integration | Log zmiany ceny |
| LRU-006 | Zmiana status | Integration | Log zmiany statusu |
| LRU-007 | Zmiana admin_notes | Integration | COALESCE dla null |
| LRU-008 | Zmiana customer_name | Integration | Log zmiany nazwy |
| LRU-009 | Zmiana vehicle_plate | Integration | Log zmiany tablicy |
| LRU-010 | change_request_note | Integration | changed_by_type='customer' |
| LRU-011 | Bez zmian = brak logu | Integration | Nie tworzy wpisu |

### I. Database Trigger: `reset_reminder_flags`

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| RRF-001 | Zmiana reservation_date | Integration | Reset reminder_1day_sent, reminder_1hour_sent |
| RRF-002 | Zmiana start_time | Integration | Reset flag |
| RRF-003 | Zmiana innych pól | Integration | Brak resetu |
| RRF-004 | Reset failure tracking | Integration | reminder_failure_count=0 |

### J. Frontend → Supabase Direct (Admin actions)

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| FAD-001 | Create reservation | Unit/E2E | Insert z confirmation_code |
| FAD-002 | Update reservation | Unit/E2E | Update wszystkich pól |
| FAD-003 | Status → in_progress | Unit/E2E | started_at timestamp |
| FAD-004 | Status → completed | Unit/E2E | completed_at timestamp |
| FAD-005 | Status → released | Unit/E2E | released_at timestamp |
| FAD-006 | Status → cancelled | Unit/E2E | cancelled_at, cancelled_by |
| FAD-007 | Status → no_show | Unit/E2E | no_show_at timestamp |
| FAD-008 | Revert to confirmed | Unit/E2E | started_at = null |
| FAD-009 | Revert to in_progress | Unit/E2E | completed_at = null |
| FAD-010 | Approve change request | Unit/E2E | Update oryginału, cancel change_requested |

### K. Phone Utils (Edge Functions)

| ID | Przypadek | Typ | Opis |
|---|---|---|---|
| PHU-001 | 9 cyfr → +48prefix | Unit | `733854184` → `+48733854184` |
| PHU-002 | 00 prefix → + | Unit | `0048733854184` → `+48733854184` |
| PHU-003 | +00 prefix | Unit | `+0048...` → `+48...` |
| PHU-004 | Trunk zero removal | Unit | `+48 (0) 733...` → `+48733...` |
| PHU-005 | Double prefix fix | Unit | `+4848733...` → `+48733...` |
| PHU-006 | International numbers | Unit | German, UK numbers |
| PHU-007 | Invalid phone fallback | Unit | Best-effort normalization |

---

## Plan implementacji

### Faza 1: Unit testy Edge Functions (Deno)

Utworzenie plików testowych:
- `supabase/functions/create-reservation-direct/index_test.ts`
- `supabase/functions/verify-sms-code/index_test.ts`
- `supabase/functions/send-sms-code/index_test.ts`
- `supabase/functions/send-reminders/index_test.ts`
- `supabase/functions/_shared/phoneUtils_test.ts`

Mockowanie:
```typescript
// Mock Supabase client
const mockSupabase = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockData }) }) }),
    insert: async () => ({ error: null }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }),
  rpc: async () => ({ data: true }),
};

// Mock fetch dla SMSAPI
globalThis.fetch = vi.fn().mockResolvedValue({
  json: async () => ({ count: 1, list: [{ id: "sms123" }] }),
});
```

### Faza 2: Integration testy Database Functions

Wykorzystanie istniejących funkcji `seed-e2e-scenario` i `seed-e2e-reset` do:
1. Seedowania danych testowych
2. Wykonania RPC
3. Weryfikacji rezultatów
4. Czyszczenia

### Faza 3: Rozszerzenie E2E

Dodanie scenariuszy dla edge case'ów w Playwright.

---

## Podsumowanie liczby testów

| Kategoria | Liczba testów |
|---|---|
| create-reservation-direct | 25 |
| verify-sms-code | 10 |
| send-sms-code | 7 |
| send-reminders | 10 |
| cancel_reservation_by_code | 6 |
| request_reservation_change_by_code | 10 |
| log_reservation_created | 5 |
| log_reservation_updated | 11 |
| reset_reminder_flags | 4 |
| Frontend Admin actions | 10 |
| Phone Utils | 7 |
| **RAZEM** | **~105 testów** |

---

## Następne kroki

1. Zatwierdzenie planu
2. Implementacja phone utils tests (najprostsze)
3. Implementacja testów create-reservation-direct
4. Implementacja pozostałych edge function tests
5. Integration tests dla RPC functions
