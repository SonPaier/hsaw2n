

## Poprawki stylistyczne drawera rezerwacji

### Zmiany w 3 plikach:

**1. `NotesAndPriceSection.tsx`**
- Label "Notatki wewnętrzne" — zmiana `text-muted-foreground` na `text-foreground` (czarny)
- Usunięcie `placeholder` z Textarea (usunięcie "dodatkowe informacje")
- Label "Kwota razem brutto" — zmiana `text-muted-foreground` na `text-foreground` (czarny)

**2. `ReservationDateTimeSection.tsx`**
- Dodanie `border-foreground/60` do SelectTrigger godziny rozpoczęcia (linia 254)
- Dodanie `border-foreground/60` do SelectTrigger godziny zakończenia (linia 276)

**3. `CustomerSection.tsx`**
- Usunięcie `<span className="text-muted-foreground text-xs">({t('common.optional')})</span>` obok "Imię / Alias klienta" (linia 108)

