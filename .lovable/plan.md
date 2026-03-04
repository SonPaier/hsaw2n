

## Plan: Pole `sms_sender_name` w tabeli `instances`

### Co robimy
Dodajemy kolumnę `sms_sender_name` (text, nullable) do tabeli `instances`. Gdy ma wartość (np. "Arm Car" dla armcar), SMSAPI wysyła SMS z tym nadawcą (`from` param). Gdy null — zachowanie jak dotychczas (domyślny nadawca SMSAPI).

### Zmiany

**1. Migracja bazy danych**
- Dodanie kolumny `sms_sender_name TEXT DEFAULT NULL` do `instances`
- UPDATE dla instancji armcar: `SET sms_sender_name = 'Arm Car'` (po slug)

**2. Edge functions — dodanie `from` do URLSearchParams**
We wszystkich 6 miejscach gdzie jest `fetch("https://api.smsapi.pl/sms.do", ...)`, trzeba:
- Pobrać `sms_sender_name` z instancji (tam gdzie jeszcze nie mamy tego w kontekście)
- Jeśli wartość nie jest null, dodać `from: senderName` do URLSearchParams

Pliki do zmiany:
- `supabase/functions/send-sms-message/index.ts` — już ma instanceId, dociągnąć sender name
- `supabase/functions/send-sms-code/index.ts` — już pobiera instancję, dodać pole
- `supabase/functions/send-reminders/index.ts` — już ma dane instancji, dodać pole
- `supabase/functions/send-offer-reminders/index.ts` — dociągnąć z instancji
- `supabase/functions/create-reservation-direct/index.ts` — już pobiera instancję
- `supabase/functions/verify-sms-code/index.ts` — już pobiera instancję

W każdym: warunkowo dodać `from` do params:
```typescript
const params: Record<string, string> = {
  to: normalizedPhone,
  message: message,
  format: "json",
  encoding: "utf-8",
};
if (senderName) params.from = senderName;
```

**3. Brak zmian w UI**
Pole nie jest edytowalne przez admina instancji — ustawiane tylko z poziomu bazy / super admina. Na razie nie dodajemy UI.

