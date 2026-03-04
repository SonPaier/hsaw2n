

## Problem: nakładające się rezerwacje są nieczytelne

Obecna logika (`getOverlapInfo` + diagonal stagger) daje każdej nakładającej się rezerwacji przesunięcie `left` i `right` po 15% na indeks. Przy 5 rezerwacjach w grupie ostatnia karta ma `left: 60%` — jest bardzo wąska i nieczytelna (widoczne na screenie: wąskie paski na Myjnia 1).

## Rozwiązanie: układ "na zakładkę"

Każda karta zachowuje **pełną szerokość** kolumny, ale jest przesunięta w lewo o mały offset (np. 8-10px na indeks). Karty nakładają się jak zakładki — wcześniejsze są pod późniejszymi (z-index rośnie z indeksem). Treść każdej karty pozostaje czytelna.

### Zmiany w `AdminCalendar.tsx`

**Linie ~1696-1705** — zmiana obliczania pozycji:

Obecny kod:
```typescript
const OVERLAP_OFFSET_PERCENT = 15;
const leftOffset = overlapInfo.hasOverlap ? overlapInfo.index * OVERLAP_OFFSET_PERCENT : 0;
const rightOffset = overlapInfo.hasOverlap ? (overlapInfo.total - 1 - overlapInfo.index) * OVERLAP_OFFSET_PERCENT : 0;
// ...
left: `calc(${leftOffset}% + 2px)`,
right: `calc(${rightOffset}% + 2px)`,
```

Nowy kod:
```typescript
const OVERLAP_OFFSET_PX = 10; // stały offset w pikselach na każdą kartę
const leftOffset = overlapInfo.hasOverlap ? overlapInfo.index * OVERLAP_OFFSET_PX : 0;
// ...
left: `calc(${leftOffset}px + 2px)`,
right: `2px`,
zIndex: isSelected ? 30 : (overlapInfo.hasOverlap ? 10 + overlapInfo.index : getTimeBasedZIndex(displayStart))
```

Efekt:
- Karta 0: `left: 2px`, karta 1: `left: 12px`, karta 2: `left: 22px` — każda pełnej szerokości
- Z-index rośnie z indeksem → późniejsze karty "przykrywają" wcześniejsze
- Widoczna jest "zakładka" (lewy brzeg) każdej przykrytej karty
- Selected card nadal ma najwyższy z-index (30)

### Jeden plik do zmiany
- `src/components/admin/AdminCalendar.tsx` — linie ~1696-1705

