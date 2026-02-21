

# Migracja tabeli `customers` -- nowe pola dla Sales CRM

## Co robimy

Dodajemy nowe kolumny do tabeli `customers` bez migracji danych (brak istniejacych rekordow z adresem/NIP).

## Migracja SQL

```sql
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS shipping_street text,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS sales_notes text;
```

Wszystkie kolumny sa `NULL`-owalne -- zero wplywu na istniejace dane i kod Studio.

## Aktualizacja `useOffer.ts`

Przy zapisie klienta z oferty -- obok sklejonego `address` -- zapisujemy tez rozbite pola:

```typescript
billing_street: offer.customerData.companyAddress || null,
billing_postal_code: offer.customerData.companyPostalCode || null,
billing_city: offer.customerData.companyCity || null,
```

Dzieki temu nowe oferty beda od razu wypelniac strukturalne pola adresowe.

## Podsumowanie

- 1 migracja SQL (11 nowych kolumn)
- 1 zmiana w `useOffer.ts` (zapis rozbitych pol adresowych)
- Bez migracji danych
- Bez wplywu na istniejacy kod Studio

