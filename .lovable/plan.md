
# Plan: Przeniesienie 3 usług do kategorii "Pranie tapicerki"

## Zakres
Przeniesienie 3 usług typu `both` z kategorii "MYJNIA SAMOCHODOWA" do "Pranie tapicerki" w instancji ARMCAR.

## Usługi do przeniesienia

| Usługa | ID |
|--------|-----|
| Pranie foteli | `b070b0c5-14ac-47ce-906c-090c2afd69cd` |
| Pranie sufitu | `eac5da3a-bbfe-4228-afc3-41ed699fbbc8` |
| Pranie podłogi | `062010e7-d2f2-4437-9ddf-b1d12797b152` |

## Operacja

Pojedyncze polecenie UPDATE zmieniające `category_id`:
- Z: `61392b5f-79ec-434e-bb43-5c2de98a0be0` (MYJNIA SAMOCHODOWA)
- Na: `9cfc5dcb-6807-441b-9d05-123adf587b85` (Pranie tapicerki)

## Szczegóły techniczne

```sql
UPDATE unified_services 
SET category_id = '9cfc5dcb-6807-441b-9d05-123adf587b85'
WHERE id IN (
  'b070b0c5-14ac-47ce-906c-090c2afd69cd',
  'eac5da3a-bbfe-4228-afc3-41ed699fbbc8',
  '062010e7-d2f2-4437-9ddf-b1d12797b152'
);
```

## Rezultat
Po wykonaniu, w kategorii "Pranie tapicerki" znajdą się te 3 usługi wraz z pozostałymi usługami prania (dywaniki, boczki, pasy).
