
## Ostrzezenie o nieobecnosci klienta (No-Show Warning)

### Cel
Po wybraniu klienta (przez wyszukiwarke imienia lub po telefonie) w drawerze rezerwacji, jesli klient mial kiedys nieobecnosc -- wyswietlic czerwony banner pod telefonem.

### Krok 1: Migracja bazy danych

Dodanie kolumny `has_no_show` (boolean, default false) do tabeli `customers` oraz triggera:

- **Kolumna:** `ALTER TABLE customers ADD COLUMN has_no_show boolean NOT NULL DEFAULT false;`
- **Trigger:** Na `AFTER UPDATE ON reservations` -- gdy `no_show_at` zmieni sie z NULL na wartosc, ustawia `has_no_show = true` na kliencie o tym samym `customer_phone` i `instance_id`.
- **Backfill:** Jednorazowy UPDATE oznaczajacy istniejacych klientow z no-show (z wylaczeniem "nastaly"/"tomek"):

```text
UPDATE customers c SET has_no_show = true
WHERE EXISTS (
  SELECT 1 FROM reservations r
  WHERE r.customer_phone = c.phone
    AND r.instance_id = c.instance_id
    AND r.no_show_at IS NOT NULL
)
AND c.name NOT ILIKE '%nastaly%'
AND c.name NOT ILIKE '%nastalyax%';
```

To oznakuje 4 klientow: Teresa Kunicka, Rafal Grzybowski, +48888031031, AGNIESZKA LESNA.

### Krok 2: `client-search-autocomplete.tsx`

- Dodanie `has_no_show` do selecta z tabeli `customers` (linia ~97: dodanie do `.select()`).
- Rozszerzenie interfejsu `Customer` o `has_no_show: boolean`.
- Przekazanie `has_no_show` w callbacku `onSelect` (rozszerzenie `ClientSearchValue`).

### Krok 3: `AddReservationDialogV2.tsx`

- Nowy state: `noShowWarning: { customerName: string; date: string; serviceName: string } | null`
- W `onCustomerSelect` (linia ~1417): po wybraniu klienta -- sprawdzic `has_no_show` z klienta. Jesli true, wykonac zapytanie:

```text
SELECT reservation_date, service_items, service_ids
FROM reservations
WHERE instance_id = X AND customer_phone = Y AND no_show_at IS NOT NULL
ORDER BY no_show_at DESC LIMIT 1
```

I ustawic `noShowWarning` z data i nazwa uslugi.

- W `selectVehicle` (linia ~926): po pobraniu danych klienta -- sprawdzic `has_no_show` z tabeli customers i analogicznie ustawic warning.
- Czyszczenie `noShowWarning` przy: `onPhoneChange`, `onClearCustomer`.
- Przekazanie `noShowWarning` jako prop do `CustomerSection`.

### Krok 4: `CustomerSection.tsx`

- Nowy prop: `noShowWarning?: { customerName: string; date: string; serviceName: string } | null`
- Renderowanie bannera pod polem telefonu (przed dropdown wynikow):

```text
+---------------------------------------------------+
| /!\ Klient Teresa Kunicka byl nieobecny na        |
|     wizycie 2026-02-23, usluga: Mycie podstawowe  |
+---------------------------------------------------+
```

Styl: `bg-red-50 border border-red-200 text-red-700 rounded-lg p-3`, ikona `AlertTriangle` z lucide-react.

### Pliki do zmiany
1. Nowa migracja SQL (kolumna + trigger + backfill)
2. `src/components/ui/client-search-autocomplete.tsx` -- `has_no_show` w select i interfejsie
3. `src/components/admin/AddReservationDialogV2.tsx` -- state + logika fetchowania no-show details
4. `src/components/admin/reservation-form/CustomerSection.tsx` -- nowy prop + czerwony banner
