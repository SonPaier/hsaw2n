
# Plan: Ulepszenia listy ofert - numeracja, padding, kwoty

## Zakres zmian

### 1. Padding na mobile (ostatnia oferta ucinana)
Dodanie `pb-24` do głównego kontenera listy ofert, aby zapobiec nakładaniu się ostatniej karty z dolnym paskiem nawigacji.

**Zmiana w `OffersView.tsx`:**
```tsx
// Zmiana z:
<div className="max-w-3xl mx-auto">

// Na:
<div className="max-w-3xl mx-auto pb-24">
```

---

### 2. Nowy format numeracji ofert

**Obecny format:** `ARM/2026/0126/011`
- PREFIX / ROK / MIESIAC+DZIEN / NUMER_W_MIESIACU

**Nowy format:** `ARM/26/01/2026/16`
- PREFIX / DZIEN / MIESIAC / ROK / NUMER_KOLEJNY_TOTAL

Numer jest inkrementalny dla całej instancji (nie resetuje się co miesiąc). Jeśli w bazie jest 15 ofert (w tym 3 usunięte), nowa oferta dostaje numer 16.

**Zmiana w bazie danych (migracja SQL):**

```sql
CREATE OR REPLACE FUNCTION public.generate_offer_number(_instance_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year TEXT;
  _month TEXT;
  _day TEXT;
  _count INTEGER;
  _prefix TEXT;
BEGIN
  _year := to_char(now(), 'YYYY');
  _month := to_char(now(), 'MM');
  _day := to_char(now(), 'DD');
  
  -- Zlicz WSZYSTKIE oferty dla instancji (bez filtrowania po dacie)
  -- Używamy MAX(id) lub COUNT z uwzględnieniem usuniętych
  SELECT COALESCE(MAX(
    CASE 
      WHEN offer_number ~ '/[0-9]+$' 
      THEN (regexp_replace(offer_number, '.*/([0-9]+)$', '\1'))::INTEGER 
      ELSE 0 
    END
  ), 0) + 1 INTO _count
  FROM public.offers
  WHERE instance_id = _instance_id;
  
  -- Pobierz prefix z slug instancji
  SELECT UPPER(LEFT(slug, 3)) INTO _prefix
  FROM public.instances
  WHERE id = _instance_id;
  
  -- Nowy format: PREFIX/DD/MM/YYYY/NUMER
  RETURN COALESCE(_prefix, 'OFF') || '/' || _day || '/' || _month || '/' || _year || '/' || _count::TEXT;
END;
$$;
```

---

### 3. Wyświetlanie kwot na mobile

Zmiana wyświetlania kwoty na liście ofert (mobile):
- Przenieść kwotę na ostatnią linię karty
- Wyświetlać jako dwie linie:
  - **Linia 1:** Kwota netto + 23% VAT
  - **Linia 2:** Kwota brutto (pogrubiona)

**Zmiana w `OffersView.tsx` - sekcja mobile layout:**

```tsx
{/* Mobile layout - 5 lines */}
<div className="sm:hidden space-y-1">
  {/* Line 1: Offer number */}
  <div className="flex items-center gap-2">
    <span className="font-medium text-sm">{offer.offer_number}</span>
    <button onClick={(e) => handleCopyOfferNumber(offer.offer_number, e)} ...>
      <ClipboardCopy className="w-3 h-3 ..." />
    </button>
  </div>
  
  {/* Line 2: Status */}
  <div className="flex flex-wrap gap-1">
    <Badge ...>{status}</Badge>
    {selectedOptionName && <Badge ...>{selectedOptionName}</Badge>}
  </div>
  
  {/* Line 3: Customer and vehicle */}
  <div className="text-sm text-muted-foreground">
    {offer.customer_data?.name} • {offer.vehicle_data?.brandModel}
  </div>
  
  {/* Line 4: Services */}
  {offer.offer_scopes?.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {offer.offer_scopes.map(scope => <Badge>{scope.name}</Badge>)}
    </div>
  )}
  
  {/* Line 5: Amount (Net + VAT / Gross) - NEW! */}
  {(offer.admin_approved_gross || offer.approved_at) && (
    <div className="pt-2 border-t mt-2 text-right">
      <div className="text-xs text-muted-foreground">
        {formatPrice((offer.admin_approved_net ?? offer.total_net))} + 23% VAT
      </div>
      <div className="font-semibold text-sm">
        {formatPrice(offer.admin_approved_gross ?? offer.total_gross)}
      </div>
    </div>
  )}
</div>
```

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| Migracja SQL | Nowa funkcja `generate_offer_number` |
| `src/components/admin/OffersView.tsx` | Padding `pb-24`, nowy layout kwot na mobile |

---

## Wizualizacja mobilna (przed i po)

**PRZED:**
```
ARM/2026/0126/011  📋       21 000 zł
🟡 Obejrzana 11:46, 17 sty
Kamil • Tesla Model Y
[PPF Full body MAT] [Dodatki]
```

**PO:**
```
ARM/26/01/2026/16  📋
🟡 Obejrzana 11:46, 17 sty
Kamil • Tesla Model Y
[PPF Full body MAT] [Dodatki]
─────────────────────────────
              17 073,17 zł + 23% VAT
                     21 000,00 zł
```

---

## Szczegóły techniczne

- **VAT stały:** 23%
- **Fallback kwoty:** `admin_approved_gross ?? total_gross` (priorytet admina)
- **Numer oferty:** Parsowanie ostatniego segmentu jako liczby do inkrementacji
- **Padding:** `pb-24` dla dolnej nawigacji mobilnej (~96px)
