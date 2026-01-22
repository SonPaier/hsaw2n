
# Plan naprawy: Globalnie poprawna obsługa stref czasowych w przypomnieniach SMS

## Problem
Funkcja `send-reminders` działa w strefie UTC, ale:
1. Daty rezerwacji są zapisane jako lokalne daty (bez strefy)
2. `send_at_time` (np. 19:00) jest interpretowane przez użytkowników jako czas polski
3. Porównanie godzin odbywa się błędnie - funkcja używa `getHours()` w UTC

Efekt: przypomnienia nie są wysyłane, flagi `reminder_1day_sent` i `reminder_1hour_sent` pozostają `NULL`.

---

## Rozwiązanie

### Krok 1: Dodanie kolumny timezone do tabeli instances

Migracja SQL:

```text
ALTER TABLE public.instances 
ADD COLUMN timezone TEXT DEFAULT 'Europe/Warsaw';

COMMENT ON COLUMN public.instances.timezone IS 
'Strefa czasowa instancji dla obliczeń przypomnień SMS (np. Europe/Warsaw)';
```

Domyślna wartość `Europe/Warsaw` zapewni, że istniejące instancje będą działać poprawnie.

---

### Krok 2: Naprawa funkcji send-reminders/index.ts

Główne zmiany w logice:

1. **Pobieranie strefy czasowej z instancji** - podczas przetwarzania rezerwacji funkcja pobierze `timezone` z instancji

2. **Funkcja pomocnicza do konwersji czasu:**
```text
function getDateInTimezone(date: Date, timezone: string): {
  dateStr: string;     // YYYY-MM-DD
  hours: number;
  minutes: number;
}
```
Użyje `Intl.DateTimeFormat` z opcją `timeZone` do poprawnej konwersji.

3. **Dla reminder_1day:**
   - Oblicz "jutro" w strefie czasowej instancji (nie UTC)
   - Pobierz aktualną godzinę w strefie instancji
   - Porównaj z `send_at_time` (teraz oba w tej samej strefie)

4. **Dla reminder_1hour:**
   - Oblicz aktualny czas w strefie instancji
   - Zbuduj pełny datetime rezerwacji jako moment w strefie instancji
   - Oblicz różnicę minut do startu wizyty

5. **Dodanie logów diagnostycznych:**
```text
console.log(`Instance ${instanceId}: timezone=${tz}, nowLocal=${nowLocal}, todayLocal=${todayStr}, tomorrowLocal=${tomorrowStr}`);
```

---

### Krok 3: Zmiany w strukturze kodu

Funkcja przetwarzania rezerwacji zostanie przeorganizowana:

```text
1. Pobierz wszystkie kandydujące rezerwacje (jak teraz)
2. Zgrupuj rezerwacje po instance_id
3. Dla każdej instancji:
   a. Pobierz timezone (cache)
   b. Oblicz "dzisiaj" i "jutro" w tej strefie
   c. Oblicz aktualną godzinę w tej strefie
   d. Przefiltruj rezerwacje:
      - 1-day: reservation_date === tomorrow_local AND current_time_local w oknie send_at_time
      - 1-hour: reservation_date === today_local AND start_time za 55-65 minut
4. Wyślij SMS
```

---

### Krok 4: Aktualizacja UI (opcjonalne, ale pomocne)

W `SmsMessageSettings.tsx` - dodać informację o strefie czasowej:

```text
<p className="text-xs text-muted-foreground">
  Godziny są interpretowane w strefie czasowej: {instanceTimezone || 'Europe/Warsaw'}
</p>
```

---

## Szczegóły techniczne

### Funkcja pomocnicza getDateTimeInTimezone

```text
function getDateTimeInTimezone(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dateStr: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  // Parse parts...
  return { year, month, day, hours, minutes, dateStr: `${year}-${month}-${day}` };
}
```

### Nowa logika dla 1-day reminder

```text
// Pobierz timezone instancji (domyślnie Europe/Warsaw)
const timezone = instanceData?.timezone || 'Europe/Warsaw';

// Oblicz "jutro" w strefie instancji
const nowLocal = getDateTimeInTimezone(new Date(), timezone);
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrowLocal = getDateTimeInTimezone(tomorrowDate, timezone);

// Sprawdź okno czasowe send_at_time
const sendAtTime = setting?.send_at_time || "19:00";
const [sendHour, sendMinute] = sendAtTime.split(":").map(Number);
const currentTotalMinutes = nowLocal.hours * 60 + nowLocal.minutes;
const sendTotalMinutes = sendHour * 60 + sendMinute;

// W oknie ±5 minut?
if (Math.abs(currentTotalMinutes - sendTotalMinutes) <= 5) {
  // Rezerwacja na jutro w tej strefie? reservation.reservation_date === tomorrowLocal.dateStr
  // Wyślij!
}
```

### Nowa logika dla 1-hour reminder

```text
const timezone = instanceData?.timezone || 'Europe/Warsaw';
const nowLocal = getDateTimeInTimezone(new Date(), timezone);

// Zbuduj datetime rezerwacji w strefie instancji
// reservation_date (YYYY-MM-DD) + start_time (HH:MM:SS) = moment lokalny
const reservationDateTimeStr = `${reservation.reservation_date}T${reservation.start_time}`;

// Konwertuj na UTC do porównania
const reservationDateTime = new Date(reservationDateTimeStr);
// Uwaga: JS parsuje to jako lokalny czas... potrzebujemy intepretować jako czas w timezone instancji

// Alternatywnie: użyj Temporal API lub ręcznej konwersji
const minutesUntilStart = calculateMinutesUntilStart(nowLocal, reservation.reservation_date, reservation.start_time);

if (minutesUntilStart >= 55 && minutesUntilStart <= 65) {
  // Wyślij!
}
```

---

## Pliki do modyfikacji

1. **Nowa migracja SQL** - dodanie kolumny `timezone` do `instances`
2. **supabase/functions/send-reminders/index.ts** - przepisanie logiki timezone
3. **(Opcjonalnie) src/components/admin/SmsMessageSettings.tsx** - wyświetlanie strefy czasowej

---

## Testy weryfikacyjne po wdrożeniu

1. Utworzyć rezerwację na "jutro" i sprawdzić czy o 19:00 czasu polskiego (lub ustawionej godzinie) logi funkcji pokazują próbę wysyłki
2. Utworzyć rezerwację na dziś + ~60 min i sprawdzić reminder_1hour
3. Sprawdzić że:
   - `reminder_1day_last_attempt_at` ustawia się przy próbie
   - `reminder_1day_sent` przechodzi na `true` po sukcesie
   - W `sms_logs` jest wpis z `reservation_id`
