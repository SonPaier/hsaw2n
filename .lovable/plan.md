
# Rozbudowa metadanych usług - "Dodatkowe właściwości usługi"

✅ **STATUS: ZAIMPLEMENTOWANE**

## Cel

Dodanie dwóch nowych pól do sekcji "Zaawansowane właściwości usługi" w formularzu edycji usługi:
1. **Trwałość produktu w miesiącach** - pole liczbowe
2. **Produkt do lakierów** - dropdown z 3 opcjami

Następnie aktualizacja metadanych dla wszystkich produktów w kategorii POWŁOKI OCHRONNE dla instancji ARMCAR.

---

## Zmiany w bazie danych

Nie są wymagane zmiany schemy - wykorzystujemy istniejącą kolumnę `metadata` (jsonb) w tabeli `unified_services`.

### Nowa struktura metadata:

```text
{
  "trwalosc_produktu_w_mesiacach": 24,
  "produkt_do_lakierow": "dowolny" | "matowe" | "ciemne",
  // ...inne istniejące pola
}
```

---

## Zmiany w UI - ServiceFormDialog.tsx

### Lokalizacja w formularzu:

Nowe pola zostaną dodane w sekcji "Zaawansowane właściwości usługi" (Collapsible), **przed szablonem przypomnień** (linia ~738).

### Nowe pola:

```text
┌─────────────────────────────────────────────────────────────┐
│ Zobacz zaawansowane właściwości usługi  ▼                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Czas trwania:  [___] min                                   │
│  ─ lub ─ Czas zależny od wielkości samochodu                │
│                                                             │
│  Widoczność usługi: [Wszędzie ▼]                            │
│                                                             │
│  ☐ Popularna usługa (skrót w formularzu rezerwacji)         │
│                                                             │
│  ──── Dodatkowe właściwości usługi ────                     │  ← NOWA SEKCJA
│                                                             │
│  Trwałość produktu:  [___] miesięcy                         │  ← NOWE
│                                                             │
│  Produkt do lakierów: [Dowolny lakier ▼]                    │  ← NOWE
│    - Lakierów matowych                                      │
│    - Lakierów ciemnych                                      │
│    - Dowolny lakier                                         │
│                                                             │
│  ────────────────────────────────────────                   │
│                                                             │
│  Szablon przypomnień: [Brak ▼]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Szczegóły implementacji

### 1. Rozszerzenie interfejsu ServiceData:

```typescript
interface ServiceData {
  // ...istniejące pola
  metadata?: {
    trwalosc_produktu_w_mesiacach?: number | null;
    produkt_do_lakierow?: 'matowe' | 'ciemne' | 'dowolny' | null;
    // zachowaj kompatybilność z innymi polami
    [key: string]: unknown;
  };
}
```

### 2. Nowe pola w formData:

```typescript
const [formData, setFormData] = useState({
  // ...istniejące pola
  trwalosc_produktu_w_mesiacach: service?.metadata?.trwalosc_produktu_w_mesiacach ?? null,
  produkt_do_lakierow: service?.metadata?.produkt_do_lakierow ?? 'dowolny',
});
```

### 3. Zapisywanie metadata przy save:

```typescript
const serviceData = {
  // ...istniejące pola
  metadata: {
    ...(service?.metadata || {}),
    trwalosc_produktu_w_mesiacach: formData.trwalosc_produktu_w_mesiacach,
    produkt_do_lakierow: formData.produkt_do_lakierow === 'dowolny' ? null : formData.produkt_do_lakierow,
  }
};
```

---

## Aktualizacja danych ARMCAR

### Usługi w kategorii POWŁOKI OCHRONNE do zaktualizowania:

| Usługa | Trwałość (mies.) | Produkt do lakierów |
|--------|------------------|---------------------|
| Elastomer 12 miesięcy | 12 | dowolny |
| Elastomer 24 miesiące | 24 | dowolny |
| Elastomer 36 miesięcy | 36 | dowolny |
| Elastomer 48 miesięcy | 48 | dowolny |
| Elastomer 60 miesięcy | 60 | dowolny |
| Gyeon Q² CanCoat EVO | 12 | dowolny |
| Gyeon Q² One EVO | 24 | dowolny |
| Gyeon Q² Mohs EVO | 36 | dowolny |
| Gyeon Q² Pure EVO | 36 | dowolny |
| Gyeon Q² Syncro EVO | 48 | dowolny |
| Gyeon Q² Pure EVO x2 | 60 | dowolny |
| Gyeon Q² Matte EVO | 24 | **matowe** |
| Gyeon Q² Tire | null | dowolny |
| Gyeon Q² View EVO | null | dowolny |
| Gyeon Quick View | null | dowolny |
| Gyeon Q² Rim EVO | null | dowolny |
| Gyeon Q² LeatherShield | null | dowolny |
| Serwis powłoki ceramicznej | null | dowolny |

---

## Pliki do modyfikacji

1. **src/components/admin/ServiceFormDialog.tsx**
   - Dodanie nowych pól w sekcji zaawansowanej
   - Rozszerzenie formData o metadata
   - Zapisywanie metadata przy upsert

2. **Aktualizacja danych w bazie** (przez narzędzie insert/update)
   - UPDATE unified_services SET metadata dla produktów POWŁOKI OCHRONNE

---

## Tłumaczenia (pl.json)

```json
{
  "priceList": {
    "form": {
      "additionalProperties": "Dodatkowe właściwości usługi",
      "productDurability": "Trwałość produktu",
      "productDurabilityMonths": "miesięcy",
      "productForPaints": "Produkt do lakierów",
      "paintTypeAny": "Dowolny lakier",
      "paintTypeMatte": "Lakierów matowych",
      "paintTypeDark": "Lakierów ciemnych"
    }
  }
}
```
