
# Dwie zmiany: ukrycie przycisków Drukuj + fix pastylek z zakresami

## Problem 1: Przyciski Drukuj wciąż widoczne

Poprzednie "wykomentowanie" nie zostało zapisane do plików. Kod nadal ma aktywne przyciski w 3 miejscach.

### Miejsca do wykomentowania:

**`src/components/offers/OfferGenerator.tsx` — linie 597-605**
```tsx
{/* TODO: Print feature - to be refined in future
<Button variant="outline" onClick={handlePrint} className="gap-2 h-12 w-12 sm:w-auto sm:px-4 bg-white">
  <Printer className="w-5 h-5" />
  <span className="hidden sm:inline">Drukuj</span>
</Button>
*/}
```
oraz linia 662 — prop `onPrint={handlePrint}` w `<OfferPreviewDialog>` zakomentować.

**`src/components/offers/OfferPreviewDialog.tsx` — linie 324-331**
```tsx
{/* TODO: Print feature - to be refined in future
<Button variant="outline" onClick={onPrint} className="gap-2">
  <Printer className="w-4 h-4" />
  Drukuj
</Button>
*/}
```

**`src/components/offers/PublicOfferCustomerView.tsx` — linie 615-624**
```tsx
{/* TODO: Print feature - to be refined in future
{mode === 'public' && (
  <button onClick={() => window.print()} ...>
    <Printer className="w-4 h-4" />
  </button>
)}
*/}
```

---

## Problem 2: Brak pastylek przy pierwszym wejściu

### Diagnoza
W `OffersView.tsx` mamy race condition:

- `useEffect([instanceId])` odpala `fetchOffers()` natychmiast przy pierwszym renderze
- W tym samym czasie `useOfferScopes` (React Query) pobiera zakresy asynchronicznie
- `fetchOffers` mapuje `scopesMap` w momencie wywołania — gdy `cachedScopes` jest jeszcze `[]`, mapa jest pusta `{}`
- Wszystkie nazwy scope'ów wychodzą jako `''`, linia `.filter(s => s.name && ...)` odfiltrowuje wszystkie pastylki

Przy powrocie na stronę React Query ma już dane w cache (7-dniowy staleTime) → pastylki działają.

### Rozwiązanie — reaktywny useMemo (zero ryzyka)

**Krok 1:** W `fetchOffers` (linia 271-295) zapisywać surowe dane bez mapowania scope'ów:
```ts
// Zamiast offersWithScopes z mapowaniem:
setOffers(data as OfferWithOptions[]);
```

**Krok 2:** Dodać `useMemo` zależny od `[offers, scopesMap]` (po linii 226):
```ts
const offersWithMappedScopes = useMemo(() => {
  return offers.map(o => {
    let selectedOptionName: string | undefined;
    const selectedState = o.selected_state as unknown as SelectedState | null;
    if (selectedState?.selectedVariants && o.offer_options) {
      const selectedOptionIds = Object.values(selectedState.selectedVariants).filter(Boolean);
      if (selectedOptionIds.length > 0) {
        const selectedOption = o.offer_options.find(opt => selectedOptionIds.includes(opt.id));
        selectedOptionName = selectedOption?.name;
      }
    }
    return {
      ...o,
      offer_scopes: [...new Set(
        o.offer_options?.map(opt => opt.scope_id).filter(Boolean) || []
      )]
        .map(id => ({ id, name: scopesMap[id as string] || '' }))
        .filter(s => s.name && s.name !== 'Dodatki'),
      selectedOptionName,
    };
  });
}, [offers, scopesMap]);
```

**Krok 3:** Zastąpić `offers` przez `offersWithMappedScopes` jako źródło dla `filteredOffers` i `paginatedOffers`.

### Dlaczego to bezpieczne?
- Brak nowych requestów do bazy — tylko reaktywne przemapowanie danych w pamięci
- Gdy `cachedScopes` dotrze (zwykle 100-300ms po pierwszym renderze), `useMemo` automatycznie przeliczy pastylki
- Przy kolejnych wejściach React Query serwuje cache natychmiast → `scopesMap` jest wypełniona przed `fetchOffers` → pastylki widoczne od razu

## Pliki do zmiany

- `src/components/offers/OfferGenerator.tsx`
- `src/components/offers/OfferPreviewDialog.tsx`
- `src/components/offers/PublicOfferCustomerView.tsx`
- `src/components/admin/OffersView.tsx`
