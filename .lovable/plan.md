
# Naprawa: opisy produktow nie widoczne w publicznej ofercie

## Problem
Na stronie publicznej oferty (np. `demo.n2wash.com/offers/xxx`) opisy produktow nie sa wyswietlane, mimo ze w podgladzie admina sa widoczne.

## Przyczyna
Strona publiczna (`PublicOfferView.tsx`) pobiera opisy produktow z tabeli `unified_services` w osobnym zapytaniu (linie 96-108). Jednak tabela `unified_services` ma polityki RLS, ktore wymagaja zalogowanego uzytkownika (`can_access_instance` sprawdza `auth.uid()`).

Klient ogladajacy oferte publiczna **nie jest zalogowany**, wiec zapytanie do `unified_services` zwraca pusty wynik - brak opisow.

Admin widzi opisy, bo jest zalogowany i ma uprawnienia do instancji.

## Rozwiazanie
Dodanie nowej polityki RLS na tabeli `unified_services` pozwalajacej na odczyt (SELECT) dla niezalogowanych uzytkownikow (rola `anon`). Jest to bezpieczne, poniewaz:
- Opisy produktow to dane publiczne (wyswietlane klientom w ofertach)
- Polityka dotyczy tylko odczytu (SELECT), nie modyfikacji
- Cennik jest i tak prezentowany publicznie w widgecie rezerwacji

### Szczegoly techniczne

**Migracja SQL:**
```sql
CREATE POLICY "Public can read service descriptions"
  ON public.unified_services
  FOR SELECT
  TO anon
  USING (true);
```

Alternatywnie, jesli chcemy ograniczyc dostep tylko do `id` i `description` (zamiast calego wiersza), mozna uzyc SECURITY DEFINER function. Jednak prostsze podejscie z polityka RLS jest wystarczajace, bo dane w tej tabeli (nazwy uslug, opisy, ceny) sa i tak prezentowane publicznie w widgecie rezerwacji.

**Brak zmian w kodzie frontendu** - zapytanie w `PublicOfferView.tsx` jest poprawne, problem lezy wylacznie w uprawnieniach bazy danych.
