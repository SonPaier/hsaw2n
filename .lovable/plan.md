
# Plan: Zamiana starego dialogu edycji usługi na nowy ServiceFormDialog

## Kontekst

Obecnie w projekcie istnieją dwa dialogi do edycji usług:

1. **Stary dialog (`AddProductDialog`)** - prosty formularz z polami:
   - Nazwa, Nazwa skrócona, Cena netto
   - Marka, Kategoria
   - Opis (z AI)
   - Szablon przypomnień
   - Dodatkowe parametry (metadata)

2. **Nowy dialog (`ServiceFormDialog`)** - pełny formularz z cennikiem:
   - Nazwa, Skrót (short_name), Kategoria
   - Ceny S/M/L lub pojedyncza cena
   - Wybór netto/brutto
   - Czasy trwania (pojedynczy lub S/M/L)
   - Opis (z AI)
   - Widoczność (wszędzie, tylko rezerwacje, tylko oferty)
   - Szablon przypomnień
   - Sekcja zaawansowana

## Miejsca użycia starego dialogu

| Plik | Kontekst |
|------|----------|
| `ProductsView.tsx` | Biblioteka produktów (usługi legacy typu offer) |
| `SummaryStepV2.tsx` | Kreator ofert - edycja usługi w podsumowaniu |
| `OfferServiceEditView.tsx` | Edytor szablonów ofert - edycja usługi w szablonie |

## Plan implementacji

### Krok 1: Przygotowanie ServiceFormDialog do użycia w różnych kontekstach

Aktualnie `ServiceFormDialog` jest ściśle związany z cennikiem. Musimy upewnić się, że:
- Może być używany bez przekazywania `onDelete` (ukrywa przycisk Usuń)
- Może być używany bez `existingServices` (pomija walidację unikalności)
- Obsługuje callback `onSaved` który odświeża dane w miejscu wywołania

### Krok 2: Aktualizacja OfferServiceEditView.tsx

Zamiana:
```tsx
// PRZED:
import { AddProductDialog } from '@/components/products/AddProductDialog';
...
<AddProductDialog
  open={!!editingProductId}
  onOpenChange={(open) => !open && setEditingProductId(null)}
  instanceId={instanceId}
  categories={[]}
  onProductAdded={async () => { ... }}
  product={scopeProducts.find(sp => sp.product_id === editingProductId)?.product as any}
/>
```

Na:
```tsx
// PO:
import { ServiceFormDialog } from '@/components/admin/ServiceFormDialog';
...
<ServiceFormDialog
  open={!!editingProductId}
  onOpenChange={(open) => !open && setEditingProductId(null)}
  instanceId={instanceId}
  categories={categories} // z prefetch unified_categories
  service={mapProductToServiceData(editingProduct)}
  onSaved={async () => { ... }}
/>
```

Szczegóły:
- Dodać fetch kategorii z `unified_categories` (już jest w komponencie jako `categoryMap`)
- Zmapować `Product` na `ServiceData` zgodnie z interfejsem
- Usunąć import `AddProductDialog`

### Krok 3: Aktualizacja SummaryStepV2.tsx

Analogiczna zamiana jak w kroku 2:
- Zamienić `AddProductDialog` na `ServiceFormDialog`
- Zmapować `editingProduct` na format `ServiceData`
- Dodać fetch kategorii (jeśli jeszcze nie ma)

### Krok 4: Aktualizacja ProductsView.tsx

Tutaj sytuacja jest bardziej złożona, ponieważ `ProductsView` obsługuje produkty typu `offer` (legacy):
- Zamienić `AddProductDialog` na `ServiceFormDialog`
- Upewnić się, że przekazywany `service_type` odpowiada kontekstowi widoku
- Zmapować strukturę `Product` na `ServiceData`

### Krok 5: Usunięcie AddProductDialog

Po przeniesieniu wszystkich użyć:
- Usunąć plik `src/components/products/AddProductDialog.tsx`
- Usunąć ewentualne nieużywane klucze tłumaczeń z `pl.json` (jeśli były specyficzne dla tego dialogu)

## Szczegóły techniczne

### Mapowanie Product -> ServiceData

```typescript
function mapProductToServiceData(product: Product | null): ServiceData | null {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    short_name: product.short_name,
    description: product.description,
    price_from: product.price_from ?? product.default_price,
    price_small: product.price_small,
    price_medium: product.price_medium,
    price_large: product.price_large,
    prices_are_net: product.prices_are_net ?? false,
    duration_minutes: product.duration_minutes,
    duration_small: product.duration_small,
    duration_medium: product.duration_medium,
    duration_large: product.duration_large,
    category_id: product.category_id,
    service_type: (product.service_type as 'both' | 'reservation' | 'offer') ?? 'both',
    visibility: product.visibility,
    reminder_template_id: product.reminder_template_id,
  };
}
```

### Zmiana kategorii

ServiceFormDialog wymaga kategorii jako `{ id: string, name: string }[]`, więc:
- W `OfferServiceEditView` wykorzystać istniejący `categoryMap` przekształcony na tablicę
- W `SummaryStepV2` dodać fetch kategorii z `unified_categories`
- W `ProductsView` wykorzystać istniejące kategorie

## Pliki do modyfikacji

1. `src/components/offers/services/OfferServiceEditView.tsx` - zamiana dialogu
2. `src/components/offers/SummaryStepV2.tsx` - zamiana dialogu
3. `src/components/admin/ProductsView.tsx` - zamiana dialogu
4. `src/components/products/AddProductDialog.tsx` - usunięcie pliku

## Ryzyko

- **Brak pola "Marka"** - ServiceFormDialog nie ma pola brand. Jeśli jest używane, trzeba je dodać lub zaakceptować brak
- **Brak "Dodatkowych parametrów"** - metadata nie jest obsługiwana w ServiceFormDialog. Do rozważenia czy jest potrzebna
