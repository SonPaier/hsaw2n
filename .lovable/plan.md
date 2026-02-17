
# Plan: Notatka wewnetrzna + Rezerwuj z oferty

## Feature 1: Notatka wewnetrzna w statusie kontaktu

### Baza danych
- Nowa kolumna `internal_notes` (text, nullable) w tabeli `offers`

### OfferFollowUpStatus.tsx
- Nowa opcja "Notatka" w dropdown (ikonka notesu)
- Nowe propsy: `hasInternalNote: boolean`, `onNoteClick: () => void`
- Ikonka notesu obok przycisku statusu, widoczna gdy notatka istnieje - klikniecie otwiera drawer

### OffersView.tsx
- Dodanie `internal_notes` do interfejsu `OfferWithOptions`
- Nowy stan `noteDrawer: { open: boolean, offerId: string, notes: string }`
- Drawer notatki (Sheet od prawej strony):
  - Naglowek "Notatka wewnetrzna" + X
  - Duzy Textarea na pelna wysokosc
  - Dolny pasek: "Anuluj" (bialy) i "Zapisz" (niebieski) - oba 50% szerokosci
- Logika zapisu: update `internal_notes` + `follow_up_phone_status = 'called_discussed'` jednoczesnie
- Przekazanie `hasInternalNote` i `onNoteClick` do OfferFollowUpStatus

---

## Feature 2: Rezerwuj z oferty

### Zamiana "Duplikuj" na "Rezerwuj"
W menu kontekstowym (trzy kropki) opcja "Duplikuj" zostaje zastapiona "Rezerwuj" z ikonka kalendarza.

### Logika tworzenia rezerwacji
- Nowy stan `reservationFromOffer` w OffersView
- Klikniecie "Rezerwuj" otwiera `AddReservationDialogV2` z prefilled data:
  - `customer_name` = offer.customer_data.name
  - `customer_phone` = offer.customer_data.phone
  - `vehicle_plate` = offer.vehicle_data.brandModel (marka + model)
  - `admin_notes` = offer.internal_notes (jesli istnieje)
  - `offer_number` = offer.offer_number
  - `price` = offer.admin_approved_gross lub offer.total_gross
  - `has_unified_services` = true (bo oferty uzytkuja unified services)
  - **`service_ids`** = unikalne `product_id` ze wszystkich `offer_option_items` (potwierdzone - to te same UUID co w `unified_services`)

### Fetch product_id w query
Aby miec `product_id` dostepne, fetch ofert w `fetchOffers()` zostanie rozszerzony o pole `product_id` w `offer_option_items`.

### Techniczne szczegoly

**Migracja SQL:**
```sql
ALTER TABLE public.offers ADD COLUMN internal_notes text;
```

**Zmieniane pliki:**
1. `src/components/admin/OfferFollowUpStatus.tsx` - nowa opcja "Notatka", propsy `hasInternalNote` + `onNoteClick`, ikonka notesu
2. `src/components/admin/OffersView.tsx`:
   - Rozszerzenie interfejsu i fetcha o `internal_notes` i `product_id`
   - Drawer notatki (Sheet)
   - Zamiana "Duplikuj" na "Rezerwuj"
   - Stan i renderowanie `AddReservationDialogV2` z danymi z oferty
   - Import `AddReservationDialogV2` + potrzebne hooki (workingHours)
   - Handler zapisu notatki z automatyczna zmiana statusu
