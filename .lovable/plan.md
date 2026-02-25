

## Plan: Uzupełnianie cen usług z oferty przy tworzeniu rezerwacji

### Analiza obecnego stanu

Funkcja `getReservationDataFromOffer` w `OffersView.tsx` (linia 468) wyciąga z oferty:
- dane klienta, pojazdu, notatki, numer oferty
- `service_ids` (product_id z `offer_option_items`)
- `price` (łączna kwota gross)

**Brakuje:** `service_items` z cenami jednostkowymi (`unit_price`) z pozycji oferty.

Dane są dostępne — każdy `offer_option_item` ma pole `unit_price` i `product_id`. Wystarczy zbudować tablicę `service_items` i przekazać ją do `AddReservationDialogV2`, który już obsługuje `service_items` w `editingReservation` (linia 462-468).

### Zmiana

**Plik: `src/components/admin/OffersView.tsx`** — funkcja `getReservationDataFromOffer`

Oprócz `service_ids`, zbudować tablicę `service_items` mapując `offer_option_items` na format `{ service_id, custom_price }`:

```text
Obecny flow:
  offer_option_items → product_id[] → service_ids

Nowy flow:
  offer_option_items → product_id[] → service_ids
  offer_option_items → { service_id: product_id, custom_price: unit_price }[] → service_items
```

Jeśli ten sam `product_id` pojawia się w kilku opcjach oferty, weźmiemy pierwszą znalezioną cenę. Ceny `null`/`undefined` zostaną pominięte (fallback do cen katalogowych).

### Szczegóły techniczne

W `getReservationDataFromOffer` dodamy:

```typescript
const serviceItems = serviceIds.map(id => {
  const item = offer.offer_options?.flatMap(opt => 
    opt.offer_option_items || []
  ).find(item => item.product_id === id);
  return {
    service_id: id,
    custom_price: item?.unit_price ?? null,
  };
});
```

I dodamy do obiektu zwracanego: `service_items: serviceItems`.

Dzięki temu `AddReservationDialogV2` automatycznie załaduje te ceny (linia 462-464) i wyświetli je w `SelectedServicesList` jako custom prices.

