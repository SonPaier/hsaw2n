

## Problem

Ikonka zielonego notesu na liscie ofert pojawia sie **tylko** gdy pole `internal_notes` jest wypelnione. Tymczasem klient zapisywal notatki w polu `notes` (publiczne notatki widoczne na ofercie dla klienta) - to jest inne pole.

Stan w bazie:
- **10 ofert** ma wypelnione `notes` (publiczne)
- **Tylko 1 oferta** ma wypelnione `internal_notes` ("aaaa" w DEM/001/2026)

Kod listy ofert dziala poprawnie - pobiera `*` (wszystkie kolumny), ikonka sprawdza `!!offer.internal_notes`. Problem polega na tym, ze pole `internal_notes` nie jest dostepne w edytorze ofert (OfferGenerator), wiec jedyny sposob jego wypelnienia to drawer "Notatka" z dropdownu statusu kontaktu.

## Rozwiazanie

### 1. `src/hooks/useOffer.ts`
- Dodac `internalNotes?: string` do interfejsu `OfferState`
- W `loadOffer`: mapowac `internal_notes` z bazy na `internalNotes` w stanie
- W `saveOffer`: wstawiac `internal_notes: offer.internalNotes || null` do obiektu zapisywanego do bazy
- Dzieki temu edycja oferty nie nadpisze istniejacych notatek wewnetrznych

### 2. `src/components/offers/CustomerDataStep.tsx`
- Dodac nowe propsy: `internalNotes?: string` i `onInternalNotesChange?: (value: string) => void`
- Dodac pole `Textarea` z etykieta **"Notatka wewnetrzna (tylko dla admina)"** obok istniejacego pola "Tresc zapytania" (`inquiry_notes`)
- Pole widoczne tylko w panelu admina, nie na publicznej ofercie

### 3. `src/components/offers/OfferGenerator.tsx`
- Przekazac `offer.internalNotes` i handler `updateOffer({ internalNotes: value })` do `CustomerDataStep`

Po tych zmianach:
- Notatki wewnetrzne beda widoczne i edytowalne w generatorze ofert
- Zapis oferty nie zgubi istniejacych notatek
- Ikonka zielonego notesu na liscie ofert bedzie sie poprawnie wyswietlac
