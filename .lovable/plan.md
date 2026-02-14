

# Kopiowanie danych ARMCAR -> Demo (zaktualizowany plan)

## Zmiana wzgledem poprzedniego planu

Zaktualizowane wartosci pol trust header i portfolio na fikcyjne dane N2Wash:

| Pole | Wartosc dla Demo |
|------|-----------------|
| offer_trust_header_title | "Dlaczego warto nam zaufac?" |
| offer_trust_description | "Profesjonalne studio detailingowe z wieloletnim doswiadczeniem. Setki zadowolonych klientow i najwyzszej jakosci materialy." |
| offer_portfolio_url | https://n2wash.com/realizacje |
| offer_google_reviews_url | https://n2wash.com/opinie |

## Bezpieczenstwo danych ARMCAR

Funkcja `seed-demo-data` bedzie dzialac wylacznie w trybie **READ z ARMCAR, WRITE do Demo**:

- ARMCAR (`4ce15650-...`): tylko SELECT - zadne INSERT/UPDATE/DELETE
- Demo (`b3c29bfe-...`): DELETE starych danych + INSERT nowych + UPDATE instances (tylko wiersz demo)
- Kazdy DELETE/INSERT/UPDATE bedzie mial explicit `WHERE instance_id = demoInstanceId`
- Dane ARMCAR sa tylko zrodlem do odczytu

## Pelny zakres operacji (bez zmian wzgledem poprzedniego planu)

### 1. Czyszczenie demo (kolejnosc FK)
- offer_option_items, offer_options, offer_history, offers
- offer_scope_products, offer_scopes
- unified_services, unified_categories
- Wszystkie z `WHERE instance_id = demoInstanceId`

### 2. Kopiowanie z ARMCAR (SELECT only)
- unified_categories (type='both') -> INSERT do demo z nowymi UUID
- unified_services (type='both') -> INSERT do demo z nowymi UUID
- offer_scopes (has_unified_services=true) -> INSERT z nowymi UUID
- offer_scope_products -> INSERT z przemapowanymi scope_id i product_id
- offers (has_unified_services=true, LIMIT 10) -> INSERT z fikcyjnymi danymi klientow
- offer_options -> INSERT z przemapowanymi offer_id i scope_id
- offer_option_items -> INSERT z przemapowanymi option_id i product_id

### 3. Update instances (tylko wiersz demo)
- Branding: 8 pol kolorow (skopiowane z ARMCAR)
- Trust header: 4 pola (fikcyjne dane N2Wash jak wyzej)
- Dane bankowe: fikcyjne (N2Wash Demo Sp. z o.o., PKO, wymyslony numer konta)
- Warunki platnosci: skopiowane z ARMCAR
- Widget config: skopiowany z ARMCAR, przemapowane ID

### 4. Fikcyjne dane klientow w ofertach
10 ofert z wymyslonymi danymi osobowymi, reszta (pojazd, kwoty, statusy) skopiowana 1:1.

## Implementacja
- Jednorazowa Edge Function `seed-demo-data`
- Po wykonaniu i weryfikacji - usuniecie funkcji

