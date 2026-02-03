# Plan: Optymalizacja SMS Reminders - ZAIMPLEMENTOWANO v01.27.09

## Status: ✅ ZAKOŃCZONO

---

## Podsumowanie zmian

### Nowy szablon SMS "Dzisiaj" (z telefonem):
```
{ShortName}: Dzisiaj masz wizyte o {HH:MM} - czekamy na Ciebie i Twoje autko! :) Tel: {phone}
```

### Weryfikacja GSM-7 (max 160 znaków):
| Segment | Przykład | Znaki |
|---------|----------|-------|
| Nazwa | `Armcar: ` | 8 |
| Tekst | `Dzisiaj masz wizyte o 10:00 - czekamy na Ciebie i Twoje autko! :) ` | 66 |
| Telefon | `Tel: 123456789` | 14 |
| **RAZEM** | | **~88 ✅** |

Wszystkie znaki są GSM-7: "wizyte" (bez ę), "autko" (bez ó) ✅

---

## Checklista weryfikacji po implementacji

### Backend (Edge Functions)
- [x] `supabase/functions/send-reminders/index.ts` - obsługa type/window
- [x] `supabase/functions/send-reminders/index.ts` - early exit (działa - "No candidates, early exit")
- [x] `supabase/functions/send-reminders/index.ts` - nowy szablon "Dzisiaj..." 
- [x] `supabase/functions/_shared/reminderUtils.ts` - `buildReminderTodaySms()`
- [x] `supabase/functions/_shared/reminderUtils.ts` - `isInHourlyWindow()`, `HOURLY_WINDOWS`
- [x] `supabase/functions/_shared/reminderUtils_test.ts` - testy dla nowych funkcji (PASS)
- [ ] `supabase/functions/get-public-config/index.ts` - można usunąć w przyszłości (nieużywane)

### Frontend
- [x] `src/lib/sentry.ts` - użycie `VITE_SENTRY_DSN`
- [x] `src/i18n/locales/pl.json` - aktualizacja `reminder_1hour.exampleTemplate`
- [x] `src/components/admin/SmsMessageSettings.tsx` - podgląd nowego szablonu (automatycznie przez pl.json)
- [x] `public/version.json` - podbito do v01.27.09

### Baza danych / CRON
- [x] Usunięcie starego CRON job (id=6 co 5 min) 
- [x] Dodanie 4 nowych CRON jobs:
  - jobid:9 `send-reminders-daily` - `0 17 * * 1-6` (17:00 UTC = 18:00 PL zimą)
  - jobid:10 `send-reminders-today-w1` - `0 6 * * 1-6` (06:00 UTC = 07:00 PL)
  - jobid:11 `send-reminders-today-w2` - `0 9 * * 1-6` (09:00 UTC = 10:00 PL)
  - jobid:12 `send-reminders-today-w3` - `0 12 * * 1-6` (12:00 UTC = 13:00 PL)
- [x] Weryfikacja działania - wszystkie zwracają status 200

### Secrets / Env
- [ ] Dodanie `VITE_SENTRY_DSN` w Lovable UI - **WYMAGA AKCJI UŻYTKOWNIKA**

### Testy manualne (curl)
- [x] `{"type": "1day"}` - response 200, skippedTimezone=4 (poprawnie - nie jest jeszcze 17:00 UTC)
- [x] `{"type": "1hour", "window": 1}` - response 200, skippedWindow=1 (poprawnie - rezerwacje poza oknem 08:00-10:59)
- [x] `{}` (backwards compat) - response 200, działa jak wcześniej

---

## Słabe strony rozwiązania

### Problem 1: Myjnia 7:00-19:00 (inne godziny pracy)

**Obecne okna (dla Armcar 8:00-17:00):**
- Okno 1 (07:00): rez. 08:00-10:59
- Okno 2 (10:00): rez. 11:00-13:59
- Okno 3 (13:00): rez. 14:00-15:59

**Problem:** Dla myjni 7:00-19:00:
- Rezerwacja o 07:00 - nie dostanie przypomnienia
- Rezerwacja o 18:00 - nie dostanie przypomnienia

**Rozwiązanie na przyszłość:** Dodatkowe okna (5:00 UTC, 15:00 UTC) lub dynamiczne okna per instancja.

### Problem 2: SMS wysłany kilka godzin przed

Przy nowej logice SMS może być wysłany np. 3h przed (07:00 dla rez. 10:30).

**Czy to problem?** Nie - "Dzisiaj masz wizytę o 10:30" jest nadal trafna informacja.

---

## Nowe okna czasowe

| Okno | CRON UTC | Czas PL | Rezerwacje |
|------|----------|---------|------------|
| 1 | 06:00 | 07:00 | 08:00-10:59 |
| 2 | 09:00 | 10:00 | 11:00-13:59 |
| 3 | 12:00 | 13:00 | 14:00-15:59 |

### Redukcja kosztów:
| Metryka | Przed | Po | Oszczędność |
|---------|-------|-----|-------------|
| send-reminders/dzień | 216 | 4 | **98%** |
| get-public-config/dzień | ~100+ | 0 | **100%** |

---

## Wymagana akcja użytkownika

Aby Sentry działało poprawnie, dodaj zmienną środowiskową `VITE_SENTRY_DSN`:

**Wartość:** Twój Sentry DSN (np. `https://xxx@yyy.ingest.sentry.io/zzz`)

Bez tego Sentry nie będzie raportować błędów (ale aplikacja działa normalnie).
