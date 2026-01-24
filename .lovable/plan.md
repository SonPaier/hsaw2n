
# Plan: Nowy komponent dodawania/edycji usługi

## Podsumowanie
Stworzę nowy, responsywny komponent formularza usługi, który:
- Na **desktop** (>768px) wyświetla się w **Dialog**
- Na **mobile/tablet** (<768px) wyświetla się w **Drawer** (od dołu)
- Ma uproszczony interfejs z opcjonalnymi polami ukrytymi pod toggle "Zaawansowane"

## Struktura formularza

### Pola podstawowe (zawsze widoczne)
| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| Nazwa skrócona | Input (text) | Nie | Wewnętrzna nazwa robocza (short_name) |
| Nazwa widoczna dla Klienta | Input (text) | **Tak** | Nazwa w ofercie i publicznym cenniku (name) |
| Cena | Input (number) | Nie | Cena bazowa - opcjonalna (jeśli puste = "-" w UI) |
| Netto/Brutto | Toggle | Nie | Domyślnie "netto" (prices_are_net) |
| Link: "Cena zależna od wielkości samochodu" | Rozwijany | Nie | Po kliknięciu pokazuje 3 pola: S/M/L |
| Opis usługi | Textarea + przycisk AI | Nie | Z opcją "Stwórz opis z AI" |

### Sekcja cen S/M/L (ukryta domyślnie)
- Wyświetlana po kliknięciu linku "Cena zależna od wielkości samochodu"
- W trybie edycji: automatycznie rozwinięta jeśli jakiekolwiek pole S/M/L ma wartość
- Pola: `price_small`, `price_medium`, `price_large`

### Pola zaawansowane (pod toggle)
| Pole | Typ | Opis |
|------|-----|------|
| Kategoria | Select | Wybór z unified_categories |
| Czas trwania | Input (number) | duration_minutes (lub S/M/L) |
| Widoczność | Select | 3 opcje: "Wszędzie", "Tylko rezerwacje", "Tylko oferty" |

## Mapowanie na bazę danych

Istniejąca kolumna `service_type` zostanie użyta do kontroli widoczności:
- `'both'` → "Wszędzie" (domyślnie)
- `'reservation'` → "Tylko rezerwacje/kalendarz"
- `'offer'` → "Tylko oferty"

Nie potrzebujemy dodawać nowej kolumny w bazie - wykorzystamy istniejącą strukturę.

## Usunięte pola (vs. obecny formularz)
- `station_type` (typ stanowiska) - usunięte
- `active` toggle - usunięte (usuwanie = soft delete)
- `is_popular` (popularna usługa) - usunięte
- `metadata` (dodatkowe parametry) - usunięte
- Czasy trwania S/M/L - przeniesione do zaawansowanych

## Architektura komponentu

```text
ServiceFormDialog.tsx (nowy plik)
├── Wrapper: Dialog (desktop) / Drawer (mobile)
├── ServiceFormContent.tsx (wspólna zawartość)
│   ├── Podstawowe pola
│   ├── Rozwijane ceny S/M/L
│   ├── Textarea + AI button
│   └── Collapsible "Zaawansowane"
└── Logika zapisu do unified_services
```

## Szczegóły techniczne

### 1. Responsywny wrapper
```tsx
// Użycie useIsMobile() do przełączania
const isMobile = useIsMobile();

return isMobile ? (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent>
      <ServiceFormContent {...props} />
    </DrawerContent>
  </Drawer>
) : (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <ServiceFormContent {...props} />
    </DialogContent>
  </Dialog>
);
```

### 2. Rozwijane ceny S/M/L
```tsx
const [showSizePrices, setShowSizePrices] = useState(
  // Auto-expand if any size price exists
  editingService?.price_small || 
  editingService?.price_medium || 
  editingService?.price_large
);
```

### 3. Generowanie opisu AI
Wykorzystanie istniejącej edge function `generate-product-description` z przyciskiem "Stwórz opis z AI" (ikona Sparkles).

### 4. Walidacja
- Tylko pole `name` jest wymagane
- Cena może być null (wyświetla "-" w UI)
- Kategoria opcjonalna

## Pliki do utworzenia/edycji

| Plik | Akcja | Opis |
|------|-------|------|
| `src/components/admin/ServiceFormDialog.tsx` | Nowy | Główny komponent z Dialog/Drawer wrapper |
| `src/components/admin/PriceListSettings.tsx` | Edycja | Wymiana starego dialogu na nowy komponent |
| `src/i18n/locales/pl.json` | Edycja | Nowe klucze tłumaczeń |

## Nowe klucze tłumaczeń
```json
{
  "priceList": {
    "form": {
      "shortName": "Nazwa skrócona",
      "clientVisibleName": "Nazwa widoczna dla Klienta",
      "priceOptional": "Cena (opcjonalna)",
      "netPrice": "Netto",
      "grossPrice": "Brutto",
      "priceBySizeLink": "Cena zależna od wielkości samochodu",
      "advanced": "Zaawansowane",
      "visibility": "Widoczność",
      "visibilityAll": "Wszędzie",
      "visibilityReservations": "Tylko rezerwacje",
      "visibilityOffers": "Tylko oferty",
      "generateDescription": "Stwórz opis z AI"
    }
  }
}
```

## Przepływ UX

1. **Dodawanie nowej usługi**:
   - Użytkownik klika "Dodaj usługę"
   - Otwiera się Dialog (web) lub Drawer (mobile)
   - Widzi uproszczony formularz z polami podstawowymi
   - Może rozwinąć ceny S/M/L klikając link
   - Może rozwinąć "Zaawansowane" dla kategorii, czasu i widoczności
   - Zapisuje usługę

2. **Edycja istniejącej usługi**:
   - Wszystkie pola wypełnione z bazy
   - Jeśli są ceny S/M/L - sekcja automatycznie rozwinięta
   - Sekcja "Zaawansowane" domyślnie zwinięta

3. **Generowanie opisu AI**:
   - Kliknięcie przycisku "Stwórz opis z AI"
   - Loader podczas generowania
   - Opis wstawiony do textarea
   - Toast "Opis wygenerowany"
