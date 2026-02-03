
# Plan: Optymalizacja SMS Reminders - Wersja z Checklistą i Analizą Słabych Stron

## Podsumowanie zmian

### Nowy szablon SMS (z telefonem):
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

## Słabe strony rozwiązania i jak je adresujemy

### Problem 1: Myjnia 7:00-19:00 (inne godziny pracy)

**Obecne okna (dla Armcar 8:00-17:00):**
- Okno 1 (07:00): rez. 08:00-10:59
- Okno 2 (10:00): rez. 11:00-13:59
- Okno 3 (13:00): rez. 14:00-15:59 (zamknięcie 17:00)

**Problem:** Dla myjni 7:00-19:00:
- Rezerwacja o 07:00 - nie dostanie przypomnienia (wysyłamy o 07:00, ale rez. jest na 07:00)
- Rezerwacja o 18:00 - nie dostanie przypomnienia (ostatnie okno o 13:00 obejmuje do 16:00)

**Rozwiązanie - dodatkowe okno:**
```text
OKNO 0 (05:00 UTC = 06:00 PL): rezerwacje 07:00-07:59 (dla wczesnych myjni)
OKNO 4 (15:00 UTC = 16:00 PL): rezerwacje 17:00-18:00 (dla późnych myjni)
```

Ale to zwiększa liczbę CRON do 6 wywołań/dzień. 

**Alternatywa - dynamiczne okna per instancja:**
Funkcja sama odczytuje `working_hours` instancji i wysyła SMS tylko jeśli rezerwacja jest w danym oknie. W ten sposób 4 okna wystarczą dla 90% przypadków.

### Problem 2: Hardcoded okna w CRON vs. różne strefy czasowe

Wszystkie instancje używają `Europe/Warsaw`, więc to nie jest problem teraz. Ale gdyby dodać myjnię w USA - okna byłyby złe.

**Rozwiązanie:** Okna w CRON są w UTC, funkcja sprawdza `timezone` instancji przed wysłaniem.

### Problem 3: SMS wysłany kilka godzin przed (a nie 1h)

Przy nowej logice SMS może być wysłany np. 3h przed (07:00 dla rez. 10:30).

**Czy to problem?** Nie - informacja "Dzisiaj masz wizytę o 10:30" jest nadal trafna. Klient wie kiedy przyjść.

---

## Co zrobię

### 1. Aktualizacja reminderUtils.ts
- Nowa funkcja `buildReminderTodaySms()` (z telefonem)
- Nowa funkcja `isInHourlyWindow()` 
- Definiowanie okien `HOURLY_WINDOWS`

### 2. Aktualizacja send-reminders/index.ts
- Dodanie parametrów `type` i `window` w body
- Logika filtrowania po oknach czasowych
- Early exit jeśli brak kandydatów
- Użycie nowego szablonu SMS dla "1hour" (teraz "today")

### 3. Aktualizacja pl.json
- Zmiana `exampleTemplate` dla `reminder_1hour` na nowy format

### 4. Aktualizacja src/lib/sentry.ts
- Użycie `VITE_SENTRY_DSN` zamiast edge function

### 5. Nowe CRON jobs (SQL)
- Usunięcie starego crona (co 5 min)
- 4 nowe: 1x dziennie + 3 okna czasowe

### 6. Aktualizacja testów
- Testy dla nowych funkcji w reminderUtils

---

## Checklista do weryfikacji po implementacji

### Backend (Edge Functions)
- [ ] `supabase/functions/send-reminders/index.ts` - obsługa type/window
- [ ] `supabase/functions/send-reminders/index.ts` - early exit
- [ ] `supabase/functions/send-reminders/index.ts` - nowy szablon "Dzisiaj..."
- [ ] `supabase/functions/_shared/reminderUtils.ts` - `buildReminderTodaySms()`
- [ ] `supabase/functions/_shared/reminderUtils.ts` - `isInHourlyWindow()`, `HOURLY_WINDOWS`
- [ ] `supabase/functions/_shared/reminderUtils_test.ts` - testy dla nowych funkcji
- [ ] `supabase/functions/get-public-config/index.ts` - sprawdzić czy można usunąć

### Frontend
- [ ] `src/lib/sentry.ts` - użycie `VITE_SENTRY_DSN`
- [ ] `src/i18n/locales/pl.json` - aktualizacja `reminder_1hour.exampleTemplate`
- [ ] `src/components/admin/SmsMessageSettings.tsx` - podgląd nowego szablonu (automatycznie przez pl.json)

### Baza danych / CRON
- [ ] Usunięcie starego CRON job (id=6) przez SQL
- [ ] Dodanie 4 nowych CRON jobs przez SQL
- [ ] Weryfikacja czy joby się wykonują (logi edge functions)

### Secrets / Env
- [ ] Dodanie `VITE_SENTRY_DSN` w Lovable UI

### Dokumentacja / Memory
- [ ] Aktualizacja memory `sms-reminder-system-architecture` o nową logikę okien

### Testy manualne
- [ ] Przetestować SMS 1-day (ręczne wywołanie z `{"type": "1day"}`)
- [ ] Przetestować SMS today window 1 (ręczne wywołanie z `{"type": "1hour", "window": 1}`)
- [ ] Sprawdzić logi czy early exit działa przy braku kandydatów
- [ ] Zweryfikować że Sentry działa po zmianie na env var

---

## Sekcja techniczna

### Okna czasowe:
```typescript
export const HOURLY_WINDOWS: Record<number, { startHour: number; endHour: number }> = {
  1: { startHour: 8, endHour: 11 },   // 08:00-10:59 → wysyłane o 07:00 PL
  2: { startHour: 11, endHour: 14 },  // 11:00-13:59 → wysyłane o 10:00 PL
  3: { startHour: 14, endHour: 16 },  // 14:00-15:59 → wysyłane o 13:00 PL
};
```

### Nowy szablon SMS:
```typescript
export function buildReminderTodaySms(params: {
  instanceName: string;
  time: string; // HH:MM
  phone?: string | null;
}): string {
  const phonePart = params.phone ? ` Tel: ${params.phone}` : "";
  return `${params.instanceName}: Dzisiaj masz wizyte o ${params.time} - czekamy na Ciebie i Twoje autko! :)${phonePart}`;
}
```

### Aktualizacja pl.json:
```json
"reminder_1hour": {
  "label": "Przypomnienie dzisiaj rano",
  "description": "Automatyczne przypomnienie wysyłane rano w dniu wizyty.",
  "exampleTemplate": "{{instanceName}}: Dzisiaj masz wizyte o 10:00 - czekamy na Ciebie i Twoje autko! :) Tel: {{reservationPhone}}"
}
```

### SQL dla nowych CRON jobs:
```sql
-- Usunięcie starego
SELECT cron.unschedule(6);

-- 1-day: 17:00 UTC
SELECT cron.schedule('send-reminders-daily', '0 17 * * 1-6', ...);

-- Okno 1: 06:00 UTC
SELECT cron.schedule('send-reminders-hourly-w1', '0 6 * * 1-6', ...);

-- Okno 2: 09:00 UTC  
SELECT cron.schedule('send-reminders-hourly-w2', '0 9 * * 1-6', ...);

-- Okno 3: 12:00 UTC
SELECT cron.schedule('send-reminders-hourly-w3', '0 12 * * 1-6', ...);
```

### Pliki do modyfikacji:
1. `supabase/functions/_shared/reminderUtils.ts`
2. `supabase/functions/_shared/reminderUtils_test.ts`
3. `supabase/functions/send-reminders/index.ts`
4. `src/lib/sentry.ts`
5. `src/i18n/locales/pl.json`
6. `public/version.json`
7. SQL (przez insert tool)

### Redukcja kosztów:
| Metryka | Przed | Po |
|---------|-------|-----|
| send-reminders/dzień | 216 | 4 |
| get-public-config/dzień | ~100+ | 0 |
| **Oszczędność** | | **~98%** |
