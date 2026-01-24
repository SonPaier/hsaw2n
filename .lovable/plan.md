

## Plan migracji szablonów ofert do zunifikowanych usług

### Cel
Przeprowadzić migrację szablonów (`offer_scopes`) ARMCAR do nowego systemu zunifikowanych usług (`service_type = 'both'`), zachowując kompatybilność wsteczną z istniejącymi ofertami.

---

### Analiza obecnego stanu

**Dane ARMCAR (instance_id: `4ce15650-...`):**
- **Aktywne szablony:** 9 (8 zwykłych + 1 Dodatki)
- **Usługi unified_services:** 80 typu 'both', 61 typu 'offer', 53 typu 'reservation'
- **Obecne powiązania:** Szablony używają usług typu 'offer'
- **Mapowanie nazw:** ~70% usług 'offer' ma odpowiednik 'both' (po identycznej nazwie)

**Problem:**
- Obecne szablony (`offer_scopes`) referencjonują `product_id` z usług typu 'offer'
- Nowe oferty powinny używać tylko usług typu 'both'
- Istniejące oferty muszą zachować działające referencje do starych szablonów

---

### Strategia migracji

Zastosujemy sprawdzony wzorzec z rezerwacji:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    OFFER_SCOPES                                  │
├─────────────────────────────────────────────────────────────────┤
│ STARE SZABLONY (has_unified_services = false)                   │
│   → Ukryte w UI                                                 │
│   → Zachowują FK do usług 'offer'                              │
│   → Istniejące oferty zachowują do nich referencje             │
├─────────────────────────────────────────────────────────────────┤
│ NOWE SZABLONY (has_unified_services = true)                     │
│   → Widoczne w UI                                               │
│   → FK do usług 'both'                                          │
│   → Nowe oferty używają tylko tych szablonów                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### Szczegółowy plan implementacji

#### Krok 1: Migracja bazy danych
Dodanie kolumny `has_unified_services` do tabeli `offer_scopes`:

```sql
ALTER TABLE offer_scopes 
ADD COLUMN has_unified_services BOOLEAN DEFAULT false;

-- Oznacz wszystkie istniejące jako legacy
UPDATE offer_scopes SET has_unified_services = false;
```

#### Krok 2: Skrypt migracji danych dla ARMCAR

Utworzenie kopii szablonów z mapowaniem usług:

```sql
-- Dla każdego aktywnego szablonu ARMCAR:
-- 1. Skopiuj offer_scopes z has_unified_services = true
-- 2. Skopiuj offer_scope_products z zamianą product_id na odpowiednik 'both'
```

**Logika mapowania usług:**
1. Szukaj usługi 'both' o identycznej nazwie
2. Jeśli brak dopasowania - pozostaw NULL (usługa do ręcznego dodania)
3. Zachowaj `variant_name`, `is_default`, `sort_order`

#### Krok 3: Aktualizacja frontendowych komponentów

**OfferServicesListView.tsx** - Lista szablonów:
```typescript
// Dodaj filtr w fetchScopes()
.eq('has_unified_services', true) // Pokazuj tylko nowe szablony
```

**ScopesStep.tsx** - Wybór szablonów w kreatorze oferty:
```typescript
// Dodaj filtr w fetchScopes()
.eq('has_unified_services', true) // Nowe oferty widzą tylko nowe szablony
```

**OfferServiceEditView.tsx** - Edycja/tworzenie szablonu:
```typescript
// Przy tworzeniu nowego szablonu
has_unified_services: true

// Drawer wyboru usług używa już hasUnifiedServices=true
// (obecnie hardcoded - bez zmian)
```

**OfferProductSelectionDrawer.tsx** - Bez zmian:
- Już filtruje po `service_type = 'both'` gdy `hasUnifiedServices = true`

#### Krok 4: Szablon "Dodatki" (is_extras_scope)

Specjalna obsługa:
1. Skopiuj szablon "Dodatki" z `has_unified_services = true`
2. Przy ładowaniu dodatków w ofercie - używaj nowego szablonu
3. Dynamiczne ładowanie usług 'both' (istniejąca logika)

---

### Mapowanie usług - brakujące odpowiedniki

Usługi typu 'offer' bez odpowiednika 'both' (wymagają ręcznego dodania lub pominięcia):
- Dekontaminacja chemiczna
- Dekontaminacja mechaniczna
- Korekta lakieru 1/2/3-etapowa
- Lekka korekta (Light One Step)
- Folia PPF Izotronik Kolor
- Powłoka Gyeon Rim EVO
- Powłoka CanCoat EVO / Matte EVO
- Bezpieczne mycie na dwa wiadra

**Opcje:**
1. Utworzenie brakujących usług 'both' przed migracją
2. Pominięcie przy mapowaniu (puste pozycje w szablonach)

---

### Zmiany w komponentach

| Plik | Zmiana |
|------|--------|
| `OfferServicesListView.tsx` | Dodanie filtru `.eq('has_unified_services', true)` |
| `ScopesStep.tsx` | Dodanie filtru `.eq('has_unified_services', true)` |
| `OfferServiceEditView.tsx` | Ustawienie `has_unified_services: true` przy insert |
| `useOffer.ts` | Bez zmian (już ustawia `has_unified_services` na ofercie) |

---

### Sekwencja wdrożenia

1. **Migracja DB:** Dodanie kolumny `has_unified_services`
2. **Skrypt danych:** Kopiowanie szablonów ARMCAR z mapowaniem
3. **Frontend:** Aktualizacja filtrów w 3 komponentach
4. **Weryfikacja:** Test tworzenia nowej oferty i edycji szablonów
5. **Cleanup (opcjonalny):** Soft-delete starych szablonów po potwierdzeniu działania

---

### Sekcja techniczna - szczegóły SQL

**Skrypt kopiowania szablonów:**
```sql
-- CTE: Mapowanie nazw usług offer -> both
WITH service_mapping AS (
  SELECT 
    offer.id as offer_service_id,
    both.id as both_service_id,
    offer.name
  FROM unified_services offer
  LEFT JOIN unified_services both 
    ON both.name = offer.name 
    AND both.service_type = 'both'
    AND both.instance_id = offer.instance_id
  WHERE offer.service_type = 'offer'
    AND offer.instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
),
-- Kopiuj szablony
new_scopes AS (
  INSERT INTO offer_scopes (
    instance_id, name, description, sort_order, active,
    has_coating_upsell, is_extras_scope, 
    default_payment_terms, default_notes, default_warranty,
    default_service_info, short_name, source,
    has_unified_services
  )
  SELECT 
    instance_id, name, description, sort_order, active,
    has_coating_upsell, is_extras_scope,
    default_payment_terms, default_notes, default_warranty,
    default_service_info, short_name, source,
    true -- has_unified_services
  FROM offer_scopes
  WHERE instance_id = '4ce15650-76c7-47e7-b5c8-32b9a2d1c321'
    AND active = true
    AND has_unified_services IS NOT TRUE
  RETURNING id, name
)
-- Kopiuj produkty z mapowaniem
INSERT INTO offer_scope_products (...)
...
```

