

# Plan: Naprawa buga - nie można wyczyścić pola "Kwota razem brutto"

## Problem
Pole "Kwota razem brutto" nie pozwala usunąć pierwszej cyfry - wraca do wartości `discountedPrice` gdy użytkownik próbuje wyczyścić pole całkowicie.

## Przyczyna
W `NotesAndPriceSection.tsx`:
```typescript
value={finalPrice !== '' ? finalPrice : discountedPrice || ''}
```
Gdy `finalPrice` staje się pustym stringiem `''`, kontrolka natychmiast przełącza się na `discountedPrice` (np. 200), co powoduje "wracanie" wartości.

## Rozwiązanie
Dodać flagę `isFocused` do inputa - gdy pole jest aktywnie edytowane (focus), pozwól na pusty string. Dopiero po opuszczeniu pola (blur) zastosuj fallback do `discountedPrice`.

### Zmiany w pliku `src/components/admin/reservation-form/NotesAndPriceSection.tsx`

```typescript
import { useState } from 'react';
// ... existing imports

export const NotesAndPriceSection = ({ ... }) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  // Determine displayed value:
  // - When focused: allow empty string (user editing)
  // - When not focused: fallback to discountedPrice if empty
  const displayedValue = isFocused 
    ? finalPrice 
    : (finalPrice !== '' ? finalPrice : (discountedPrice || ''));

  return (
    <>
      {/* ... notes section unchanged ... */}

      {showPrice && (
        <div className="space-y-2">
          {/* ... label unchanged ... */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              id="finalPrice"
              type="number"
              value={displayedValue}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => {
                markUserEditing?.();
                onFinalPriceUserEdit?.();
                setFinalPrice(e.target.value);
              }}
              className="w-32"
              placeholder={discountedPrice > 0 ? String(discountedPrice) : '0'}
            />
            {/* ... rest unchanged ... */}
          </div>
        </div>
      )}
    </>
  );
};
```

## Co to rozwiązuje
| Scenariusz | Przed | Po |
|------------|-------|-----|
| Usuwanie cyfr (focus) | `200→20→2→200` ❌ | `200→20→2→""` ✅ |
| Wpisanie nowej wartości | Nie można wyczyścić | Można wyczyścić i wpisać `50` |
| Opuszczenie pustego pola | N/A | Wraca do `discountedPrice` (fallback) |

## Alternatywne rozwiązanie (prostsze, bez state)
Zamiast dodawać state `isFocused`, można uprościć logikę:
```typescript
value={finalPrice}
placeholder={discountedPrice > 0 ? String(discountedPrice) : '0'}
```
Ale to wymaga dodatkowej obsługi w `onBlur` aby ustawić `finalPrice` na `discountedPrice` gdy pole jest puste przy zapisie.

**Rekomenduję rozwiązanie z `isFocused`** - jest bezpieczniejsze i nie zmienia logiki zapisu.

## Sekcja techniczna

### Plik do modyfikacji
- `src/components/admin/reservation-form/NotesAndPriceSection.tsx`

### Zmienione linie
- Import: dodać `useState` z React
- Dodać state: `const [isFocused, setIsFocused] = useState(false);`
- Dodać computed value: `const displayedValue = ...`
- Input: dodać `onFocus`, `onBlur`, zmienić `value`

### Wpływ na testy
- Test `NotesAndPriceSection.test.tsx` powinien nadal przechodzić
- Można dodać nowy test case dla scenariusza focus/blur

