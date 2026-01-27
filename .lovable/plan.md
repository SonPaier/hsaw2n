
# Plan: Usunięcie pola "Typ serwisu" z dialogu dodawania przypomnienia

## Problem

Pole "Typ serwisu" w dialogu "Dodaj przypomnienie" jest zbędne, ponieważ wybrany szablon przypomnienia już zawiera typy serwisów dla każdego zaplanowanego przypomnienia (w tablicy `items`).

Aktualny flow:
- Użytkownik wybiera szablon (np. "Ceramika 48 miesięcy")
- Szablon ma zdefiniowane elementy, np:
  - 12 miesięcy: "odswiezenie_powloki"
  - 24 miesiące: "serwis"
  - 36 miesięcy: "kontrola"
- Pole "Typ serwisu" w formularzu jest ignorowane (używane tylko jako fallback gdy szablon nie ma typu)

## Dodatkowy bug

Na screenshocie widać błąd tłumaczenia - wyświetla się surowy klucz `offers.serviceTypes.odswiezenie` zamiast przetłumaczonego tekstu. W bazie wartość to `odswiezenie` ale klucz tłumaczenia w SERVICE_TYPES używa tego samego `labelKey`.

## Pliki do modyfikacji

### 1. `src/components/admin/AddCustomerReminderDialog.tsx`

**Zmiany:**

1. Usunąć stałą `SERVICE_TYPES` (linie 33-38) - niepotrzebna
2. Usunąć stan `serviceType` (linia 78) - niepotrzebny
3. Usunąć reset `serviceType` w `resetForm()` (linia 151)
4. Usunąć całą sekcję "Service Type" z JSX (linie 287-302)
5. Uprościć tworzenie przypomnienia - używać tylko `item.service_type` bez fallbacku (linia 198)

### Przed (zbędny kod):

```typescript
const SERVICE_TYPES = [
  { value: 'serwis', labelKey: 'serwis' },
  { value: 'kontrola', labelKey: 'kontrola' },
  // ...
];

const [serviceType, setServiceType] = useState('serwis');

// W handleSubmit:
service_type: item.service_type || serviceType,

// W JSX - cała sekcja Select dla typu serwisu
```

### Po (uproszczony kod):

```typescript
// Usunięta stała SERVICE_TYPES
// Usunięty stan serviceType

// W handleSubmit:
service_type: item.service_type,

// Usunięta sekcja Select z formularza
```

## Sekcja techniczna

### Walidacja

Każdy element szablonu (`ReminderTemplateItem`) ma wymagane pole `service_type`, więc nie ma potrzeby fallbacku. Edytor szablonów (`AddReminderTemplateDialog.tsx`) wymusza wybór typu dla każdego elementu.

### Wpływ na UX

- Dialog będzie prostszy (3 pola zamiast 4)
- Mniej miejsca na błąd użytkownika
- Jasna logika: szablon = kompletny harmonogram przypomnień
