
# Plan: Utworzenie 88 usług typu 'both' dla ARMCAR

## Przegląd
Tworzymy 88 nowych rekordów w tabeli `unified_services` z `service_type = 'both'` dla instancji ARMCAR. Istniejące 111 usług (60 offer + 51 reservation) pozostają nienaruszone dla kompatybilności wstecznej z historycznymi danymi.

## Stan przed
| Typ | Liczba |
|-----|--------|
| offer | 60 |
| reservation | 51 |
| both | 0 |
| **SUMA** | **111** |

## Stan po
| Typ | Liczba |
|-----|--------|
| offer | 60 (bez zmian) |
| reservation | 51 (bez zmian) |
| both | 88 (NOWE) |
| **SUMA** | **199** |

---

## Źródła danych

### Z usług typu OFFER (60 usług)
Kopiujemy wszystkie 60 usług z następującymi transformacjami:
- Nowe UUID dla każdej usługi
- `service_type = 'both'`
- `prices_are_net = true`
- Nowe `category_id` według mappingu (stare kategorie offer → nowe kategorie both)
- Aktualizacja cen dla 23 usług według tabeli price_updates

### Z usług typu RESERVATION (28 usług unikatowych)
Kopiujemy 28 usług (pomijamy 23 duplikaty) z:
- Nowe UUID dla każdej usługi
- `service_type = 'both'`
- Zachowane oryginalne `prices_are_net` z kategorii źródłowej
- Nowe `category_id` według mappingu (stare kategorie reservation → nowe kategorie both)

---

## Mapping kategorii

| Stara kategoria (offer) | Stara kategoria (reservation) | Nowa kategoria (both) |
|-------------------------|-------------------------------|------------------------|
| `aa7f28ad-...` KOREKTA LAKIERU | `a92aea20-...` Korekta lakieru | `699d3dda-78ce-4f1b-bcef-b3db23ec8283` |
| `46aa3c7e-...` USŁUGI DETAILINGOWE | `9e95ff64-...` Usługi | `86f4bf1d-e957-43c8-81a6-8a3417915141` |
| `3bd01d67-...` MYJNIA SAMOCHODOWA | `09cfc4d6-...` Myjnia | `61392b5f-79ec-434e-bb43-5c2de98a0be0` |
| `ca918cb9-...` WRAPPING - FOLIA PPF | `88a13f0d-...` Folie PPF | `198c253c-6b21-401a-a540-7f0419af9bd8` |
| `188d37d1-...` POWŁOKI OCHRONNE | `56e8c776-...` Powłoki | `bac704db-cffa-4036-862e-654f7218347a` |
| — | `a6a710e2-...` Pranie tapicerki | `9cfc5dcb-6807-441b-9d05-123adf587b85` |
| — | `98c33c76-...` Dodatkowe usługi | `e7d076bd-ca1a-4d09-9760-b0b32740b937` |
| — | `0589446e-...` Moveno | `5283a1c0-a882-4232-9c19-f112dead8a70` |

---

## Aktualizacje cen (23 usługi z OFFER)

Te usługi otrzymają wyższą cenę (z RESERVATION):

| UUID źródłowy | Nazwa | Nowa cena |
|---------------|-------|-----------|
| `e9a7d303-...` | Pranie foteli | 150 |
| `1d428b88-...` | Pranie sufitu | 300 |
| `10a1b9b7-...` | Pranie podłogi | 200 |
| `2b30ff58-...` | Pranie dywaników | 100 |
| `7200aa50-...` | Pranie boczków | 100 |
| `89b7ee61-...` | Pranie pasów | 100 |
| `dd40261c-...` | Bezpieczne mycie | 250 |
| `7f426169-...` | Mycie silnika | 300 |
| `1c728a56-...` | Mycie podwozia | 200 |
| `b2591558-...` | Ozonowanie | 200 |
| `96b92ea7-...` | Czyszczenie skór | 350 |
| `6841449c-...` | Polerowanie reflektorów | 250 |
| `ae6320aa-...` | Zaprawki lakiernicze | 350 |
| `71c1f69f-...` | Korekta punktowa | 250 |
| `0e0de28f-...` | Lekka korekta | 800 |
| `f2741be8-...` | Korekta 1-etapowa | 1000 |
| `f267197a-...` | Korekta 2-etapowa | 1800 |
| `6243a991-...` | Korekta 3-etapowa | 2800 |
| `2ab4f33c-...` | Dekontaminacja mechaniczna | 1200 |
| `6e83f6c5-...` | Dekontaminacja chemiczna | 350 |
| `5d39288f-...` | Mycie detailingowe | 350 |
| `58b010ea-...` | Detailingowe wnętrze | 400 |
| `d6a8b8c5-...` | Usługi dodatkowe | 1 |

---

## Lista 23 duplikatów do pominięcia (RESERVATION)

Te usługi NIE będą kopiowane z RESERVATION (ich odpowiedniki są w OFFER):

1. Pranie foteli
2. Pranie podsufitki  
3. Pranie podłogi
4. Pranie dywaników
5. Pranie boczków
6. Pranie pasów
7. Bezpieczne mycie na dwa wiadra
8. Mycie silnika
9. Mycie podwozia hurricanem
10. Ozonowanie
11. Czyszczenie i konserwacja skór
12. Polerowanie reflektorów
13. Zaprawki lakiernicze
14. Korekta punktowa
15. Lekka korekta
16. Korekta 1-etapowa
17. Korekta 2-etapowa
18. Korekta 3-etapowa
19. Dekontaminacja chemiczna
20. Dekontaminacja mechaniczna
21. Mycie detailingowe
22. Detailingowe czyszczenie wewnętrzne
23. Usuwanie wgnieceń PDR

---

## Szczegóły techniczne

### Kolumny do skopiowania z OFFER
```text
name, short_name, description, default_price*, unit, 
default_validity_days, default_payment_terms, 
default_warranty_terms, default_service_info, metadata
```
*z aktualizacją ceny dla 23 usług

### Kolumny do skopiowania z RESERVATION
```text
name, shortcut→short_name, description, 
price_small, price_medium, price_large, price_from,
duration_small, duration_medium, duration_large, duration_minutes,
requires_size, is_popular, station_type
```

### Kolumny do ustawienia
```text
id: gen_random_uuid()
instance_id: '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
service_type: 'both'
category_id: według mappingu
prices_are_net: true (OFFER) / z kategorii (RESERVATION)
active: true
```

---

## Kroki implementacji

1. **INSERT usług z OFFER (60 rekordów)**
   - Wygeneruj nowe UUID
   - Zmapuj category_id na nowe kategorie 'both'
   - Zastosuj price_updates dla 23 usług
   - Ustaw service_type='both', prices_are_net=true

2. **INSERT usług z RESERVATION (28 rekordów)**
   - Pomiń 23 duplikaty z listy
   - Wygeneruj nowe UUID
   - Zmapuj category_id na nowe kategorie 'both'
   - Zachowaj prices_are_net z kategorii źródłowej
   - Ustaw service_type='both'

3. **Weryfikacja**
   - Sprawdź że mamy 88 nowych usług typu 'both'
   - Sprawdź integralność category_id
   - Sprawdź poprawność cen

---

## Oczekiwany rezultat

Po wykonaniu operacji w tabeli unified_services:
- 60 usług offer (nienaruszone)
- 51 usług reservation (nienaruszone)  
- 88 usług both (NOWE)
- **Łącznie: 199 usług**

Wszystkie nowe usługi będą miały poprawne powiązania z 8 kategoriami typu 'both'.
