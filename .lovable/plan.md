

## Plan: Dodanie kategorii Myjnia z 3 usługami do cennika ULTRAFIT

### Instancja
- `29f15eeb-5ada-446c-9351-0194dbc886fd` (ultrafit)

### Nowa kategoria

| Nazwa | category_type | sort_order |
|-------|---------------|------------|
| Myjnia | both | 6 |

### 3 usługi (ceny wg rozmiarów jak w ARMCAR)

| # | Pełna nazwa | short_name | S | M | L | dur S | dur M | dur L | Opis |
|---|-------------|------------|---|---|---|-------|-------|-------|------|
| 1 | Mycie zewnętrzne | Mycie zewn. | 50 | 60 | 80 | 30 | 35 | 40 | Ręczne mycie zewnętrzne nadwozia z użyciem profesjonalnej chemii samochodowej. |
| 2 | Odkurzanie wnętrza | Odkurzanie | 30 | 40 | 50 | 20 | 25 | 30 | Dokładne odkurzanie całego wnętrza pojazdu wraz z zakamarkami i szczelinami. |
| 3 | Komplet mycia (zewnątrz + odkurzanie wnętrza) | Komplet mycia | 130 | 160 | 200 | 90 | 100 | 120 | Kompleksowe mycie zewnętrzne połączone z odkurzaniem całego wnętrza pojazdu. |

### Parametry każdej usługi
- `service_type`: `both`
- `visibility`: `everywhere`
- `active`: `true`
- `prices_are_net`: `true`
- `requires_size`: `true`

### Szczegóły techniczne
- INSERT do `unified_categories` (1 nowa kategoria "Myjnia")
- INSERT do `unified_services` (3 rekordy) z cenami rozmiarowymi (price_small/medium/large) oraz czasami trwania (duration_small/medium/large) wzorowanymi na ARMCAR
- Brak zmian w kodzie - tylko operacje na bazie danych

