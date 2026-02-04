# Plan: Naprawa buga - wszystkie usługi wyświetlane przy edycji oferty

## Status: ✅ ZAIMPLEMENTOWANO

## Problem
Po zapisaniu nowej oferty i powrocie do jej edycji, krok 3 (Summary) wyświetlał WSZYSTKIE usługi z szablonu zamiast tylko tych, które zostały zapisane.

Dodatkowo przy tworzeniu nowej oferty, gdy szablon nie miał żadnych produktów z `is_default: true`, wyświetlane były wszystkie produkty zamiast pustej listy.

## Rozwiązanie

### Zmiana 1: `src/hooks/useOffer.ts` - `generateOptionsFromScopes`
**Linie 173-205**: Funkcja teraz filtruje tylko produkty z `is_default: true`:
```typescript
.filter(p => p.scope_id === scope.id && p.is_default) // Only default products!
```

### Zmiana 2: `src/hooks/useOffer.ts` - `updateSelectedScopes`
**Linie 243-302**: Dla zapisanych ofert (has `offer.id`) nie regeneruje options z szablonów - zachowuje dane załadowane przez `loadOffer`.

### Zmiana 3: `src/components/offers/SummaryStepV2.tsx` - `useEffect` dependency
**Linia 481**: Dodano `offer.id` do dependency array żeby `useEffect` wiedział kiedy oferta jest nowa vs zapisana:
```typescript
}, [instanceId, offer.selectedScopeIds, offer.id]);
```

## Test cases
| Scenariusz | Oczekiwane zachowanie |
|------------|----------------------|
| Tworzenie nowej oferty | Krok 3 pokazuje tylko `is_default` produkty ✅ |
| Tworzenie oferty z szablonu bez defaults | Krok 3 pokazuje pustą listę ✅ |
| Edycja zapisanej oferty | Krok 3 pokazuje TYLKO zapisane produkty ✅ |
| Edycja zapisanej oferty + dodanie nowego scope | Nowy scope dostaje `is_default` produkty ✅ |
