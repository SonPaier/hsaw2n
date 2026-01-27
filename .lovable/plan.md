
# Plan: Komponent zarządzania pojazdami klienta

## Cel
Wydzielenie logiki zarządzania pojazdami (wyszukiwarka + chips) do osobnego komponentu `CustomerVehiclesEditor`, który będzie używany w `CustomerEditDrawer` w trybie edycji.

## Nowy komponent

### `src/components/admin/CustomerVehiclesEditor.tsx`

```text
┌─────────────────────────────────────────────────┐
│ Pojazdy                                         │
├─────────────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ ┌──────┐ │
│ │ [Wyszukaj model auta...]           │ │ Dodaj│ │
│ └────────────────────────────────────┘ └──────┘ │
├─────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐       │
│ │ Audi SQ8    [X]  │ │ BMW Seria 3  [X] │       │
│ └──────────────────┘ └──────────────────┘       │
└─────────────────────────────────────────────────┘
```

### Interfejs komponentu

```typescript
interface VehicleChip {
  id?: string;           // ID z bazy (jeśli istnieje)
  model: string;         // Nazwa modelu
  carSize: 'S' | 'M' | 'L';
  isNew?: boolean;       // Czy nowo dodany
}

interface CustomerVehiclesEditorProps {
  vehicles: VehicleChip[];
  onChange: (vehicles: VehicleChip[]) => void;
  disabled?: boolean;
}
```

### Logika komponentu
1. **Stan wewnętrzny**: `vehicleSearchValue` (string), `pendingVehicle` (CarSearchValue)
2. **Wyszukiwarka**: Używa istniejącego `CarSearchAutocomplete`
3. **Dodawanie**: Po wybraniu modelu i kliknięciu "Dodaj":
   - Sprawdza duplikaty (po `model`)
   - Dodaje do listy z `isNew: true`
   - Czyści input
4. **Usuwanie**: Kliknięcie X na chipsie usuwa pojazd z listy
5. **Styl chips**: Biały, `rounded-full`, border, identyczny jak w VehicleSection

---

## Zmiany w CustomerEditDrawer.tsx

### Nowy stan
```typescript
const [editVehicles, setEditVehicles] = useState<VehicleChip[]>([]);
```

### Pobieranie pojazdów przy otwarciu (tryb edycji)
Dodanie fetcha do `customer_vehicles` przy otwieraniu drawera z istniejącym klientem.

### Dodanie komponentu do formularza edycji
Wstawienie `<CustomerVehiclesEditor>` pod polem "Rabat %".

### Zapisywanie pojazdów
W `handleSaveCustomer`:
1. Pobierz aktualne pojazdy klienta z bazy
2. Usuń pojazdy które zostały usunięte (porównanie po `id`)
3. Dodaj nowe pojazdy (`isNew: true`)

---

## Nowe tłumaczenia (pl.json)

```json
{
  "customers": {
    "addVehicle": "Dodaj",
    "searchVehicle": "Wyszukaj model auta..."
  }
}
```

---

## Pliki do utworzenia/modyfikacji

| Plik | Operacja |
|------|----------|
| `src/components/admin/CustomerVehiclesEditor.tsx` | Nowy |
| `src/components/admin/CustomerEditDrawer.tsx` | Modyfikacja |
| `src/i18n/locales/pl.json` | Dodanie tłumaczeń |

