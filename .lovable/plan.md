
# Plan: Utility do normalizacji wyszukiwania

## Cel
Stworzenie jednej funkcji utility do usuwania spacji z zapytań wyszukiwania, którą będzie można używać we wszystkich komponentach wyszukiwania.

## Implementacja

### 1. Dodanie funkcji do `src/lib/textUtils.ts`

```typescript
/**
 * Normalizes a search query by removing all whitespace characters.
 * Used for space-agnostic searching of phone numbers, offer numbers, etc.
 * 
 * @param query - The search query string
 * @returns Query with all whitespace removed
 * 
 * @example
 * normalizeSearchQuery("511 042 123") // returns "511042123"
 * normalizeSearchQuery("+48 733 854 184") // returns "+48733854184"
 */
export const normalizeSearchQuery = (query: string): string => {
  if (!query) return '';
  return query.replace(/\s/g, '');
};
```

### 2. Użycie w komponentach

Import we wszystkich plikach wyszukiwania:
```typescript
import { normalizeSearchQuery } from '@/lib/textUtils';
```

Przykład użycia:
```typescript
const normalizedQuery = normalizeSearchQuery(searchTerm);
const matchesPhone = normalizeSearchQuery(customer.phone).includes(normalizedQuery);
```

### 3. Pliki do aktualizacji

| Plik | Zmiana |
|------|--------|
| `src/lib/textUtils.ts` | Dodanie funkcji `normalizeSearchQuery` |
| `src/components/admin/CustomersView.tsx` | Import + użycie dla telefonu |
| `src/components/admin/OffersView.tsx` | Import + użycie dla telefonu i numeru oferty |
| `src/components/admin/ReservationsView.tsx` | Import + użycie dla telefonu i kodu |
| `src/components/protocols/ProtocolsView.tsx` | Import + użycie dla numeru oferty i rejestracji |
| `src/components/ui/client-search-autocomplete.tsx` | Import + użycie w zapytaniu |
| `src/components/protocols/OfferSearchAutocomplete.tsx` | Import + użycie w zapytaniu |

## Korzyści
- Jedna funkcja zamiast powtórzonego kodu w 6 miejscach
- Łatwa modyfikacja logiki w przyszłości (np. usuwanie też myślników)
- Czytelniejszy kod z jasną nazwą funkcji
- Możliwość dodania testów jednostkowych w jednym miejscu
