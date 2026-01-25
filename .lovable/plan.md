
# Plan naprawy: service_type nie może być zmieniane dla zunifikowanych usług

## Podsumowanie problemu

Pole `service_type` w `unified_services` określa przynależność do modelu danych:
- `'reservation'` - legacy usługi rezerwacyjne
- `'offer'` - legacy usługi ofertowe  
- `'both'` - zunifikowane usługi (nowy model)

**Problem:** UI "Widoczność usługi" pozwala zmienić `service_type`, co powoduje że usługi znikają z cennika (bo cennik filtruje `service_type = 'both'`).

## Bugi do naprawienia

### Bug 1: AddProductDialog tworzy produkty z service_type: 'offer'
**Plik:** `src/components/products/AddProductDialog.tsx`

Nowe produkty tworzone z ProductsView mają `service_type: 'offer'`, przez co nie pojawiają się w zunifikowanym cenniku.

**Naprawa:** Zmienić na `service_type: 'both'`

### Bug 2: ServiceFormDialog nadpisuje service_type
**Plik:** `src/components/admin/ServiceFormDialog.tsx` (linie 689-708)

Select "Widoczność usługi" zapisuje wybór do pola `service_type`. Dla zunifikowanych usług powoduje to ich "zniknięcie" z cennika.

**Naprawa:** Ukryć sekcję visibility dla usług z `service_type = 'both'`

## Szczegóły techniczne

### Zmiana w AddProductDialog.tsx

Lokalizacja: około linii 281

```typescript
// Przed:
service_type: 'offer',

// Po:
service_type: 'both',
```

### Zmiana w ServiceFormDialog.tsx

Lokalizacja: linie 689-708

```typescript
// Przed:
<div className="space-y-2">
  <div className="flex items-center gap-1.5">
    <Label className="text-sm">{t('priceList.form.visibilityService', 'Widoczność usługi')}</Label>
    ...
  </div>
  <Select
    value={formData.service_type}
    onValueChange={(v) => setFormData(prev => ({ ...prev, service_type: v }))}
  >
    ...
  </Select>
</div>

// Po:
{/* Visibility - tylko dla legacy usług, ukryte dla zunifikowanych */}
{formData.service_type !== 'both' && (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5">
      <Label className="text-sm">{t('priceList.form.visibilityService', 'Widoczność usługi')}</Label>
      ...
    </div>
    <Select
      value={formData.service_type}
      onValueChange={(v) => setFormData(prev => ({ ...prev, service_type: v }))}
    >
      ...
    </Select>
  </div>
)}
```

### Naprawa danych w bazie (jednorazowa migracja SQL)

Przywrócenie `service_type = 'both'` dla usług przypisanych do kategorii typu 'both':

```sql
UPDATE unified_services us
SET service_type = 'both'
FROM unified_categories uc
WHERE us.category_id = uc.id
  AND uc.category_type = 'both'
  AND us.service_type != 'both';
```

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `AddProductDialog.tsx` | `service_type: 'offer'` → `'both'` |
| `ServiceFormDialog.tsx` | Ukrycie sekcji visibility gdy `service_type = 'both'` |
| Migracja SQL | Naprawa istniejących danych |

## Efekt po zmianach

- Nowe produkty będą widoczne w cenniku (service_type = 'both')
- Edycja zunifikowanych usług nie zmieni ich service_type
- Usunięte usługi wrócą do cennika po migracji SQL
- Legacy usługi nadal mogą mieć zmienianą visibility (bez wpływu na nowy cennik)
