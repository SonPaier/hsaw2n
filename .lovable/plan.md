

# Plan: Masowe dodanie przypomnien dla klientow z ofert

## Podsumowanie

Wstawienie przypomnien SMS do bazy danych dla 33 klientow (35 minus #2 Robert - wykluczony). Dane zostana wstawione bezposrednio do tabeli `customer_reminders` za pomoca migracji SQL. Nie wymaga zmian w kodzie aplikacji.

## Istniejace szablony w bazie

| Szablon | ID | Elementy |
|---|---|---|
| Ceramika 12 miesiecy | `553e9c77...` | +7 mies. odsw. |
| Ceramika 24 miesiace | `6033cafe...` | +7, +14 mies. odsw. |
| Ceramika 36 miesiecy | `39700591...` | +7, +14, +21 mies. odsw. |
| Ceramika 48 miesiecy | `5193a31b...` | +7, +14, +21, +28 mies. odsw. |
| Ceramika 60 miesiecy | `f36a3d47...` | +7, +14, +21, +28, +35, +42 mies. odsw. |
| PPF Folia | `f6d18a1f...` | +1 kontrola, +12 serwis |

## Dane do wstawienia (33 wpisy, laczenie ~80 rekordow customer_reminders)

### CERAMIKA

| # | Klient | Telefon | Pojazd | Szablon | Data uslugi | Przypomnienia |
|---|---|---|---|---|---|---|
| 1 | Arteon | 48600714138 | Volkswagen Arteon | Ceramika 12 mies. | 2026-02-09 | 2026-09-09 (+7) odsw. |
| 3 | Mazda CX | 48601807417 | Mazda CX-60 | Ceramika 24 mies. | 2026-04-27 | 2026-11-27 (+7), 2027-06-27 (+14) |
| 4 | Leon | 48694451044 | SEAT Leon | Ceramika 24 mies. | 2026-05-04 | 2026-12-04 (+7), 2027-07-04 (+14) |
| 5 | BMW X5 | 48570554413 | BMW X5 | Ceramika 36 mies. | 2025-10-24 | 2026-05-24 (+7), 2026-12-24 (+14), 2027-07-24 (+21) |
| 6 | Audi A5 | 48510143210 | Audi A5 | Ceramika 24 mies. | 2025-11-08 | 2026-06-08 (+7), 2027-01-08 (+14) |
| 7 | BMW Seria 5 | 48733060573 | BMW Seria 5 | Ceramika 36 mies. | 2026-04-06 | 2026-11-06 (+7), 2027-06-06 (+14), 2028-01-06 (+21) |
| 8 | Audi Q5 | 48508070107 | Audi Q5 | Ceramika 36 mies. | 2025-11-03 | 2026-06-03 (+7), 2027-01-03 (+14), 2027-08-03 (+21) |
| 9 | BMW Seria 3 | 48784590065 | BMW Seria 3 | Ceramika 24 mies. | 2026-05-25 | 2026-12-25 (+7), 2027-07-25 (+14) |
| 10 | Nissan Qashqai | 48510444764 | Nissan Qashqai | Ceramika 60 mies. | 2025-12-01 | 2026-07-01 (+7), 2027-02-01 (+14), 2027-09-01 (+21), 2028-04-01 (+28), 2028-11-01 (+35), 2029-06-01 (+42) |
| 11 | Lexus LS | 48792548455 | Lexus LS | Ceramika 12 mies. | 2026-08-08 | 2027-03-08 (+7) odsw. |
| 12 | Honda Civic | 48697787519 | Honda Civic | Ceramika 12 mies. | 2026-01-12 | 2026-08-12 (+7) odsw. |
| 13 | Skoda Superb | 48531877071 | Škoda Superb | Ceramika 12 mies. | 2026-02-10 | 2026-09-10 (+7) odsw. |
| 14 | Mercedes CLA | 48601556097 | Mercedes-Benz CLA | Ceramika 36 mies. | 2025-12-01 | 2026-07-01 (+7), 2027-02-01 (+14), 2027-09-01 (+21) |
| 15 | Volvo XC70 | 48787361101 | Volvo XC70 | Ceramika 36 mies. | 2026-02-16 | 2026-09-16 (+7), 2027-04-16 (+14), 2027-11-16 (+21) |
| 16 | Leon | 48609274377 | SEAT Leon | Ceramika 36 mies. | 2026-10-19 | 2027-05-19 (+7), 2027-12-19 (+14), 2028-07-19 (+21) |
| 17 | Volvo XC90 | 48510222396 | Volvo XC90 | Ceramika 36 mies. | 2026-05-04 | 2026-12-04 (+7), 2027-07-04 (+14), 2028-02-04 (+21) |
| 19 | Skoda VRS | 48733854184 | Škoda Octavia | Ceramika 12 mies. | 2026-12-11 | 2027-07-11 (+7) odsw. |

### PPF FOLIA

| # | Klient | Telefon | Pojazd | Data uslugi | Przypomnienia |
|---|---|---|---|---|---|
| 18 | Porsche Panamera (666610222) | 48666610222 | Porsche Panamera | 2026-10-11 | 2026-11-11 (+1) kontrola, 2027-10-11 (+12) serwis |
| 20 | Julia Land (BMW) | 48510332379 | BMW Seria 3 | 2026-10-11 | 2027-10-11 (+12) serwis tylko |
| 21 | VW Amarok | 48723392997 | Volkswagen Amarok | 2026-09-01 | 2027-09-01 (+12) serwis tylko |
| 22 | Pawel (BYD) | 48725656424 | BYD Seal | 2026-08-01 | 2027-08-01 (+12) serwis tylko |
| 23 | Miłosz Mercedes E | 48512157058 | Mercedes-Benz Klasa E | 2026-08-01 | 2026-09-01 (+1) kontrola, 2027-08-01 (+12) serwis |
| 24 | Cupra Formentor | 48518292123 | Cupra Formentor | 2026-09-01 | 2027-09-01 (+12) serwis tylko |
| 25 | Kacper Mercedes CLE | 48605740977 | Mercedes-Benz CLE | 2026-06-01 | 2026-07-01 (+1) kontrola, 2027-06-01 (+12) serwis |
| 26 | Marek Mercedes GLE | 48506046002 | Mercedes-Benz GLE | 2026-07-01 | 2026-08-01 (+1) serwis |
| 27 | BMW Seria 3 | 48781452168 | BMW Seria 3 | 2026-10-01 | 2026-11-01 (+1) serwis, 2027-10-01 (+12) serwis |
| 28 | Porsche Panamera 4 | 48533838000 | Porsche Panamera | 2026-11-14 | 2026-12-14 (+1) serwis, 2027-11-14 (+12) serwis |
| 29 | Audi A3 | 48503418760 | Audi A3 | 2026-11-10 | 2026-12-10 (+1) serwis, 2027-11-10 (+12) serwis |
| 30 | DS7 | 48501162374 | DS DS7 | 2026-12-07 | 2027-01-07 (+1) serwis, 2027-12-07 (+12) serwis |

### ZMIANA KOLORU (szablon PPF Folia)

| # | Klient | Telefon | Pojazd | Data uslugi | Przypomnienia |
|---|---|---|---|---|---|
| 31 | Porsche Cayenne | 48606885703 | Porsche Cayenne | 2026-11-07 | 2026-12-07 (+1) serwis, 2027-11-07 (+12) serwis |
| 32 | BMW X4 | 48502596646 | BMW X4 | 2026-10-16 | 2026-11-16 (+1) serwis, 2027-10-16 (+12) serwis |

### INNE / SERWISY

| # | Klient | Telefon | Pojazd | Szablon | Data uslugi | Przypomnienia |
|---|---|---|---|---|---|---|
| 33a | Ksiegowa (Suzuki) | 48513939898 | Suzuki Swift | PPF Folia | 2026-04-13 | 2026-05-13 (+1) kontrola, 2027-04-13 (+12) serwis |
| 33b | Ksiegowa (Mini) | 48513939898 | MINI Cooper | PPF Folia | 2026-04-13 | 2026-05-13 (+1) kontrola, 2027-04-13 (+12) serwis |
| 34 | Astra | 48733854184 | Opel Astra | Ceramika 12 mies. | 2025-11-21 | 2026-06-21 (+7) odsw. |
| 35 | Kia Niro | 48883960131 | Kia Niro | Ceramika 12 mies. | 2026-10-09 | 2027-05-09 (+7) odsw. |

## Uwagi specjalne

- **#1 Arteon**: Biuro potwierdzilo "istniejaca powloka" - uzyje szablonu Ceramika 12 mies. (1 serwis odsw.)
- **#2 Robert**: POMINIETA - biuro potwierdzilo "nie wpisywac"
- **#3 Mazda CX**: Serwis platny (gratis juz byl)
- **#11 Lexus**: Brakujaca data = 08.08.2026 (podana przez biuro)
- **#19 Skoda VRS**: "Ceramika na folie" - uzyje szablonu Ceramika 12 mies.
- **#20-22**: Tylko serwis za rok (bez kontroli +1 mies.)
- **#24 Cupra**: Biuro potwierdzilo bez kontroli, tylko serwis +12
- **#26 Marek**: Tylko +1 mies. serwis (nie kontrola)
- **#31-32 Zmiana koloru**: Biuro potwierdzilo "serwis foli" - uzyje PPF Folia
- **#33 Ksiegowa**: "Serwis" - uzyje PPF Folia dla obu aut
- **#34 Astra**: Serwis ceramiki co 7 mies. - uzyje Ceramika 12 mies.
- **#35 Kia Niro**: Data 09.10.2026, serwis - uzyje Ceramika 12 mies.

## Szczegoly techniczne

### Krok 1: Migracja SQL

Jedna migracja SQL z instrukcjami `INSERT INTO customer_reminders` zawierajaca wszystkie ~80 rekordow. Kazdy rekord bedzie mial:
- `instance_id`: `4ce15650-76c7-47e7-b5c8-32b9a2d1c321`
- `reminder_template_id`: odpowiedni UUID szablonu
- `customer_name`: z tabeli `customers`
- `customer_phone`: znormalizowany (48XXXXXXXXX)
- `vehicle_plate`: nazwa modelu pojazdu (bo brak tablic rejestracyjnych)
- `service_type`: `odswiezenie_powloki` / `serwis` / `kontrola`
- `scheduled_date`: obliczona data
- `months_after`: liczba miesiecy po dacie uslugi
- `status`: `scheduled`

### Krok 2: Weryfikacja

Po migracji - zapytanie sprawdzajace liczbe wstawionych rekordow.

### Uwaga o nietypowych przypadkach

Klienci #20-22 i #24 maja tylko serwis za 12 mies. (bez kontroli +1). Zostana wstawione recznie z `months_after=12`, mimo ze szablon PPF Folia ma rowniez kontrole +1. Szablon `reminder_template_id` bedzie ustawiony na PPF Folia dla spojnosci, ale konkretne przypomnienia beda wstawione wedlug danych z biura.

