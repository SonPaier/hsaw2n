

## Plan: Rozszerzenie okna czasowego crona send-reminders

### Cel
Zmienić harmonogram crona `send-reminders-every-5-minutes` z `*/5 7-20 * * *` na `*/5 6-22 * * *`, aby obsługiwać przypomnienia SMS wysyłane wcześniej rano (od 6:00) i później wieczorem (do 22:59).

### Aktualna konfiguracja
| Parametr | Wartość |
|----------|---------|
| Job ID | 4 |
| Nazwa | send-reminders-every-5-minutes |
| Harmonogram | `*/5 7-20 * * *` (co 5 min, 07:00-20:59) |

### Nowa konfiguracja
| Parametr | Wartość |
|----------|---------|
| Harmonogram | `*/5 6-22 * * *` (co 5 min, 06:00-22:59) |

### Zmiana
Wykonam jedno polecenie SQL przez `cron.alter_job()`:

```sql
SELECT cron.alter_job(
  job_id := 4,
  schedule := '*/5 6-22 * * *'
);
```

### Wpływ zmiany
- **Przed**: Cron działa od 07:00 do 20:59 (14 godzin)
- **Po**: Cron działa od 06:00 do 22:59 (17 godzin)
- Umożliwi wysyłkę przypomnień ustawionych na godziny 21:00-22:59 oraz 06:00-06:59

### Po wdrożeniu
Test z ustawieniem `send_at_time = 21:40` powinien zadziałać przy najbliższym wywołaniu crona (co 5 minut).

