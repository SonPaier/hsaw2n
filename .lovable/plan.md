

## Plan: Utworzenie kategorii i usług foliowych w cenniku ULTRAFIT

### Instancja
- `29f15eeb-5ada-446c-9351-0194dbc886fd` (ultrafit)

### Krok 1: Utworzenie 4 kategorii w `unified_categories`

| # | Nazwa | category_type | sort_order |
|---|-------|---------------|------------|
| 1 | Folie Bezbarwne i Teksturowane | both | 1 |
| 2 | Folie Kolorowe (PPF Color) | both | 2 |
| 3 | Seria Efektowa i Metaliczna | both | 3 |
| 4 | Folie do Lamp | both | 4 |

### Krok 2: Utworzenie 13 usług w `unified_services`

Wszystkie z domyslna cena **1000 zl** (`price_from = 1000`), `service_type = 'both'`, `visibility = 'everywhere'`, `active = true`, `prices_are_net = true`.

| # | Pelna nazwa | short_name | Kategoria | Opis |
|---|-------------|------------|-----------|------|
| 1 | Folia ochronna PPF ULTRAFIT XP Crystal | Crystal | Folie Bezbarwne i Teksturowane | To najbardziej zaawansowana bezbarwna folia ochronna wykonana w technologii Nano Ceramic... |
| 2 | Folia ochronna PPF ULTRAFIT XP Retro Matte | Retro Matte | Folie Bezbarwne i Teksturowane | Folia ta zmienia blyszczacy lakier w eleganckie, satynowe wykonczenie... |
| 3 | Folia ochronna PPF ULTRAFIT XP Black Carbon | Black Carbon | Folie Bezbarwne i Teksturowane | Produkt ten imituje strukture wlokna weglowego z glebokim efektem 3D... |
| 4 | Folia ochronna PPF ULTRAFIT XP Black (High Gloss) | Black High Gloss | Folie Kolorowe (PPF Color) | Folia oferuje efekt "fortepianowej czerni" o lustrzanym polysku... |
| 5 | Folia ochronna PPF ULTRAFIT XP Black Matte | Black Matte | Folie Kolorowe (PPF Color) | Jest to matowa wersja glebokiej czerni... |
| 6 | Folia ochronna PPF ULTRAFIT XP Black Forged | Black Forged | Folie Kolorowe (PPF Color) | Unikalna folia o wzorze kutego karbonu (Forged Carbon)... |
| 7 | Folia ochronna PPF ULTRAFIT XP Stone Beige | Stone Beige | Folie Kolorowe (PPF Color) | Folia w odcieniu klasycznego, piaskowego bezu... |
| 8 | Folia ochronna PPF ULTRAFIT XP Mountain Gray | Mountain Gray | Folie Kolorowe (PPF Color) | Stylowy, ciemnoszary odcien inspirowany kolorami gorskimi... |
| 9 | Folia ochronna PPF ULTRAFIT XP Tuscan Yellow | Tuscan Yellow | Folie Kolorowe (PPF Color) | Intensywnie zolta folia ochronna... |
| 10 | Folia ochronna PPF ULTRAFIT XP Retro Metallic Silver | Metallic Silver | Seria Efektowa i Metaliczna | Srebrna folia o metalicznym ziarnie... |
| 11 | Folia ochronna PPF ULTRAFIT XP Metallic Rose Silver | Rose Silver | Seria Efektowa i Metaliczna | Ekskluzywna folia o efekcie "flip-flop"... |
| 12 | Folia ochronna PPF ULTRAFIT Aurora Purple | Aurora Purple | Seria Efektowa i Metaliczna | Folie z tej serii charakteryzuja sie perlowym, opalizujacym wykonczeniem... |
| 13 | Folia ochronna PPF ULTRAFIT XP Graphite (Headlight PPF) | Graphite | Folie do Lamp | Specjalistyczna folia do przyciemniania reflektorow... |

### Szczegoly techniczne

- INSERT do `unified_categories` (4 rekordy) z referencja do instance_id ultrafit
- INSERT do `unified_services` (13 rekordow) z `category_id` odpowiadajacym nowo utworzonym kategoriom, `price_from = 1000`, pelne opisy z wiadomosci uzytkownika
- Brak zmian w kodzie - tylko operacje na bazie danych

