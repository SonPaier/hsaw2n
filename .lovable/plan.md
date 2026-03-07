

## Plan: Email z potwierdzeniem zamówienia

### 1. Nowa Edge Function: `send-order-confirmation`
Nowa funkcja Deno (`supabase/functions/send-order-confirmation/index.ts`) wzorowana na istniejącym `send-offer-email`:
- Przyjmuje `orderId` w body
- Pobiera zamówienie z `sales_orders` + pozycje z `sales_order_items` + dane instancji z `instances` + email klienta z `customers`
- Pobiera `is_net_payer` z tabeli `customers` dla danego klienta
- Buduje HTML email wg szablonu (ten sam branding: szare tło #f0f0f0, biały boks, Inter font, stopka z danymi firmy)
- Jeśli klient jest płatnikiem brutto (`is_net_payer = false`), dodaje linijkę "Suma całkowita brutto: [kwota]"
- Jeśli klient jest płatnikiem netto (`is_net_payer = true`), nie dodaje linijki brutto
- Wysyła przez SMTP (te same sekrety co offer email)
- Mapuje `delivery_type` i `payment_method` na polskie nazwy

Treść emaila dokładnie jak w specyfikacji użytkownika.

### 2. Edycja `AddSalesOrderDrawer.tsx`
- Po pomyślnym zapisie zamówienia (INSERT), jeśli `sendEmail === true`:
  - Wywołaj `supabase.functions.invoke('send-order-confirmation', { body: { orderId } })`
  - Pokaż toast sukcesu/błędu
- Pobieraj email klienta, aby wyświetlić info jeśli brak emaila (opcjonalne)

### 3. config.toml
Dodać sekcję `[functions.send-order-confirmation]` z `verify_jwt = false`.

### Pliki do utworzenia
- `supabase/functions/send-order-confirmation/index.ts`

### Pliki do edycji
- `src/components/sales/AddSalesOrderDrawer.tsx` — wywołanie edge function po zapisie
- `supabase/config.toml` — rejestracja nowej funkcji

