

## Plan: Rozbudowa widoku Klienci w Sales CRM

### Zakres zmian

**1. Migracja bazy danych** — dodanie kolumny `is_net_payer` (boolean, default false) do tabeli `customers`.

**2. SalesCustomersView.tsx** — zmiany w tabeli:
- Usunąć kolumnę "Opiekun"
- Dodać kolumnę "Ostatnie zamówienie" (na razie placeholder "—", bo zamówienia nie są jeszcze w DB)
- Dodać kolumnę "Płatnik" — wyświetla "netto" lub "brutto" na podstawie `is_net_payer` z danych klienta
- Podłączyć dane klientów z Supabase (zamiast pustej tablicy `[]`)
- Otwieranie drawera po kliknięciu wiersza + "Dodaj klienta"

**3. Nowy komponent: `NipLookupForm.tsx`** — skopiowany z N2Service, lookup NIP z GUS API (`wl-api.mf.gov.pl`), pola: NIP + przycisk "Pobierz z GUS", nazwa firmy, ulica, kod pocztowy, miasto. Tryb readOnly do widoku.

**4. Nowy komponent: `AddEditSalesCustomerDrawer.tsx`** — Sheet z formularzem:
- **Sekcja główna:** Nazwa, Osoba kontaktowa, Telefon, Email
- **Toggle Rabat** + pole liczbowe % (zapisuje do `discount_percent`)
- **Toggle Płatnik netto** (zapisuje do `is_net_payer`)
- Notatki (textarea)
- **Separator + Adres wysyłki:** Adresat, Ulica, Kod pocztowy, Miasto (zapisuje do `shipping_*` kolumn)
- **Separator + Dane firmy** (Collapsible): NipLookupForm — NIP z GUS lookup, nazwa firmy, adres fakturowy (zapisuje do `nip`, `company`, `billing_*`)
- **Tryb widoku** z tabami "Dane" / "Zamówienia" (wzór z N2Service CustomerEditDrawer)
- Sticky header + footer z przyciskami Zapisz/Anuluj/Edytuj

**5. Zapis do Supabase:** INSERT/UPDATE na tabeli `customers` z `source: 'sales'`, używając istniejących kolumn (`contact_person`, `discount_percent`, `is_net_payer`, `shipping_*`, `billing_*`, `nip`, `company`, `sales_notes`).

### Pliki do utworzenia
- `src/components/sales/NipLookupForm.tsx` — kopia z N2Service
- `src/components/sales/AddEditSalesCustomerDrawer.tsx` — nowy drawer

### Pliki do edycji
- `src/components/sales/SalesCustomersView.tsx` — przebudowa tabeli + integracja z DB i drawerem

### Migracja
```sql
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_net_payer boolean NOT NULL DEFAULT false;
```

