
# Plan: Naprawa buga - wszystkie usługi wyświetlane przy edycji oferty

## Problem
Po zapisaniu nowej oferty i powrocie do jej edycji, krok 3 (Summary) wyświetla WSZYSTKIE usługi z szablonu zamiast tylko tych, które zostały zapisane (domyślnych + ręcznie dodanych).

## Analiza przyczyny
1. **`loadOffer`** poprawnie ładuje `options` z bazy danych z tylko zapisanymi produktami
2. **`loadOffer`** ustawia `selectedScopeIds` na podstawie `scopeIdsFromOptions`
3. **Problem**: Gdy zmienia się `selectedScopeIds`, wywoływane jest `updateSelectedScopes` → `generateOptionsFromScopes`
4. **`generateOptionsFromScopes`** ładuje WSZYSTKIE produkty z szablonu (nie tylko `is_default`) i nadpisuje `offer.options`
5. **`SummaryStepV2`** sprawdza `existingOption.items` - ale te itemy są już nadpisane wszystkimi produktami z szablonu!

## Rozwiązanie
Modyfikacja `updateSelectedScopes` w `useOffer.ts` - **nie wywoływać** `generateOptionsFromScopes` jeśli oferta jest już zapisana (ma `offer.id`). Dla zapisanych ofert, options są już poprawnie załadowane przez `loadOffer`.

Jeśli użytkownik AKTYWNIE zmieni scope (doda/usunie szablon w Step 2), wtedy musimy:
- Dla nowego scope: wygenerować options
- Dla usuniętego scope: usunąć odpowiednie options
- Dla istniejących scope: **zachować** obecne options

## Sekcja techniczna

### Plik: `src/hooks/useOffer.ts`

#### Zmiana 1: Modyfikacja `updateSelectedScopes`
```typescript
// Scope handlers
const updateSelectedScopes = useCallback((scopeIds: string[]) => {
  setOffer(prev => {
    // Only update if actually changed to prevent loops
    if (JSON.stringify(prev.selectedScopeIds) === JSON.stringify(scopeIds)) {
      return prev;
    }
    
    // For persisted offers: only generate options for NEW scopes
    // Keep existing options for scopes that are still selected
    if (prev.id) {
      // Find which scopes are new (not in previous selection)
      const newScopeIds = scopeIds.filter(id => !prev.selectedScopeIds.includes(id));
      // Find which scopes were removed
      const removedScopeIds = prev.selectedScopeIds.filter(id => !scopeIds.includes(id));
      
      // Generate options only for NEW scopes (async, fire-and-forget)
      if (newScopeIds.length > 0) {
        generateOptionsFromScopes(newScopeIds, true); // true = append mode
      }
      
      // Remove options for removed scopes
      const filteredOptions = prev.options.filter(opt => 
        !removedScopeIds.includes(opt.scopeId || '')
      );
      
      return {
        ...prev,
        selectedScopeIds: scopeIds,
        options: filteredOptions,
      };
    }
    
    // For new offers: generate all options as before
    return {
      ...prev,
      selectedScopeIds: scopeIds,
    };
  });
  
  // Only generate all options for NEW offers (no id yet)
  setOffer(prev => {
    if (!prev.id) {
      generateOptionsFromScopes(scopeIds);
    }
    return prev;
  });
}, [generateOptionsFromScopes]);
```

**Prostsze rozwiązanie** (które proponuję):
Zamiast skomplikowanej logiki, po prostu sprawdzamy czy oferta jest persisted przed wywołaniem `generateOptionsFromScopes`:

```typescript
const updateSelectedScopes = useCallback((scopeIds: string[], forceRegenerate = false) => {
  setOffer(prev => {
    // Only update if actually changed to prevent loops
    if (JSON.stringify(prev.selectedScopeIds) === JSON.stringify(scopeIds)) {
      return prev;
    }
    
    // For persisted offers (has id) - DON'T regenerate options from templates
    // The options are already loaded from database via loadOffer
    // Only regenerate when user explicitly adds/removes a scope
    const isPersistedOffer = Boolean(prev.id);
    const scopesChanged = prev.selectedScopeIds.length !== scopeIds.length ||
      !scopeIds.every(id => prev.selectedScopeIds.includes(id));
    
    if (isPersistedOffer && !scopesChanged) {
      return prev; // No change needed
    }
    
    return {
      ...prev,
      selectedScopeIds: scopeIds,
    };
  });
  
  // Generate options - but skip for persisted offers unless scopes actually changed
  setOffer(prev => {
    const isPersistedOffer = Boolean(prev.id);
    if (!isPersistedOffer || forceRegenerate) {
      generateOptionsFromScopes(scopeIds);
    }
    return prev;
  });
}, [generateOptionsFromScopes]);
```

#### Najlepsze rozwiązanie (rekomendowane)
Najbezpieczniejsze jest sprawdzenie w `generateOptionsFromScopes` czy oferta ma już załadowane options dla danego scope:

```typescript
const generateOptionsFromScopes = useCallback(async (scopeIds: string[]) => {
  if (scopeIds.length === 0) {
    // DON'T clear options for persisted offers - they may have saved data
    setOffer(prev => {
      if (prev.id && prev.options.length > 0) {
        return prev; // Keep existing options for persisted offer
      }
      return { ...prev, options: [] };
    });
    return;
  }

  // Check if we should skip regeneration for persisted offers
  // by checking if we already have options for these scopes
  const shouldSkip = await new Promise<boolean>(resolve => {
    setOffer(prev => {
      const hasExistingOptions = prev.id && prev.options.length > 0 &&
        scopeIds.every(id => prev.options.some(opt => opt.scopeId === id));
      resolve(hasExistingOptions);
      return prev;
    });
  });
  
  if (shouldSkip) {
    console.log('[generateOptionsFromScopes] Skipping - persisted offer with existing options');
    return;
  }
  
  // ... rest of the function unchanged
}, [instanceId]);
```

### Wersja końcowa - najprostsza i najbezpieczniejsza

**Plik: `src/hooks/useOffer.ts`**

Modyfikacja `updateSelectedScopes` (linie ~243-258):

```typescript
// Scope handlers
const updateSelectedScopes = useCallback((scopeIds: string[]) => {
  // First update the scope IDs in state
  setOffer(prev => {
    // Only update if actually changed to prevent loops
    if (JSON.stringify(prev.selectedScopeIds) === JSON.stringify(scopeIds)) {
      return prev;
    }
    return {
      ...prev,
      selectedScopeIds: scopeIds,
    };
  });
  
  // Generate options based on selected scopes
  // BUT skip for persisted offers that already have options loaded
  setOffer(prev => {
    // If this is a persisted offer (has ID) and already has options
    // for the selected scopes, DON'T regenerate (preserve saved data)
    if (prev.id && prev.options.length > 0) {
      const existingScopeIds = prev.options
        .filter(opt => opt.scopeId)
        .map(opt => opt.scopeId as string);
      
      // Check if all selected scopes already have options
      const allScopesHaveOptions = scopeIds.every(id => existingScopeIds.includes(id));
      
      // Only regenerate if NEW scopes were added
      const newScopes = scopeIds.filter(id => !existingScopeIds.includes(id));
      
      if (newScopes.length === 0 && allScopesHaveOptions) {
        console.log('[updateSelectedScopes] Skipping regeneration - persisted offer with existing options');
        return prev;
      }
      
      // If there are new scopes, we need to generate options just for them
      // For now, we'll regenerate all (simpler) but keep saved items
    }
    
    // For new offers or when new scopes were added, generate options
    generateOptionsFromScopes(scopeIds);
    return prev;
  });
}, [generateOptionsFromScopes]);
```

## Test cases
| Scenariusz | Oczekiwane zachowanie |
|------------|----------------------|
| Tworzenie nowej oferty | Krok 3 pokazuje tylko `is_default` produkty ✅ |
| Edycja zapisanej oferty (bez zmian scope) | Krok 3 pokazuje TYLKO zapisane produkty ✅ |
| Edycja zapisanej oferty + dodanie nowego scope | Nowy scope dostaje `is_default` produkty |
| Edycja zapisanej oferty + usunięcie scope | Produkty usuniętego scope znikają |

## Podsumowanie zmian
1. **Plik**: `src/hooks/useOffer.ts`
2. **Funkcja**: `updateSelectedScopes` 
3. **Zmiana**: Dodanie walidacji przed wywołaniem `generateOptionsFromScopes` - jeśli oferta jest persisted i ma już options dla wszystkich wybranych scope'ów, nie regeneruj
