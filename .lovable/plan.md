
# Plan: Telefon opcjonalny w ofercie

## Cel
Upewnić się, że numer telefonu jest w pełni opcjonalny przy tworzeniu oferty - pusty telefon zapisywany jako `null`.

## Kontekst
- Polskie numery stacjonarne mają 9 cyfr (kierunkowy + numer) - tak samo jak komórkowe
- Obecna logika normalizacji już poprawnie obsługuje oba typy numerów
- Jedyny problem: przy zapisie oferty, pusty telefon jest normalizowany do pustego stringa

## Zmiany do wykonania

### 1. `src/hooks/useOffer.ts` - zapis klienta

**Obecny kod (linia ~774 i ~789):**
```typescript
phone: normalizePhone(offer.customerData.phone) || ''
```

**Nowy kod:**
```typescript
phone: offer.customerData.phone?.trim() ? normalizePhone(offer.customerData.phone) : null
```

Logika:
- Jeśli telefon jest pusty lub zawiera tylko spacje → zapisz `null`
- Jeśli telefon ma wartość → normalizuj i zapisz

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/hooks/useOffer.ts` | Zmienić logikę zapisu telefonu klienta (~2 miejsca) |

## Testy do wykonania
1. Utworzyć ofertę bez numeru telefonu - powinno się zapisać bez błędu
2. Utworzyć ofertę z numerem komórkowym (np. `733 854 184`) - normalizacja do `+48733854184`
3. Utworzyć ofertę z numerem stacjonarnym (np. `22 123 45 67`) - normalizacja do `+48221234567`
4. Edytować istniejącą ofertę i usunąć numer telefonu - powinno zapisać `null`
