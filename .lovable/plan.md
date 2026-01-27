
# Plan: Dodanie zakładki "Przypisani Klienci" do widoku edycji szablonu przypomnienia

## Cel

Rozbudować widok edycji szablonu przypomnienia (`ReminderTemplateEditPage.tsx`) o dwie zakładki:
1. **Szablon** - obecny formularz edycji
2. **Przypisani Klienci** - lista klientów przypisanych do tego szablonu z możliwością otwarcia drawera klienta

Dodatkowo wyodrębnić reużywalny komponent listy klientów.

## Struktura zmian

### 1. Nowy komponent: `src/components/admin/CustomersList.tsx`

Reużywalny komponent listy klientów wyodrębniony z `CustomersView.tsx`:

**Props:**
```typescript
interface CustomersListProps {
  customers: Customer[];
  vehicles: CustomerVehicle[];
  instanceId: string | null;
  onCustomerClick: (customer: Customer) => void;
  emptyMessage?: string;
  showActions?: boolean; // Phone, SMS, Delete buttons
}
```

**Zawartość:**
- Renderowanie listy klientów (name, phone, vehicle chips)
- Obsługa pustego stanu
- Klikalne wiersze wywołujące `onCustomerClick`
- Opcjonalne przyciski akcji (telefon, SMS, usuń)

### 2. Nowy komponent: `src/components/admin/TemplateAssignedCustomers.tsx`

Zakładka "Przypisani Klienci" dla szablonu przypomnienia:

**Logika:**
- Pobiera unikalnych klientów z tabeli `customer_reminders` przez `reminder_template_id`
- Grupuje po `customer_phone` (jeden klient może mieć wiele przypomnień)
- Wykorzystuje `CustomersList` do renderowania

**Zapytanie SQL:**
```sql
SELECT DISTINCT customer_name, customer_phone 
FROM customer_reminders 
WHERE reminder_template_id = ? AND instance_id = ?
```

### 3. Modyfikacja: `src/pages/ReminderTemplateEditPage.tsx`

**Zmiany:**
- Import Tabs z `@/components/ui/tabs` i `AdminTabsList`/`AdminTabsTrigger`
- Dodanie stanu `activeTab` ("template" | "customers")
- Owinięcie formularza w `<TabsContent value="template">`
- Dodanie `<TabsContent value="customers">` z komponentem `TemplateAssignedCustomers`
- Ukrycie zakładek dla nowego szablonu (`isNew`)

**Struktura UI:**
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <AdminTabsList columns={2}>
    <AdminTabsTrigger value="template">Szablon</AdminTabsTrigger>
    <AdminTabsTrigger value="customers">Przypisani Klienci</AdminTabsTrigger>
  </AdminTabsList>
  
  <TabsContent value="template">
    {/* Obecny formularz */}
  </TabsContent>
  
  <TabsContent value="customers">
    <TemplateAssignedCustomers 
      templateId={templateId}
      instanceId={instanceId}
    />
  </TabsContent>
</Tabs>
```

### 4. Nowe tłumaczenia w `src/i18n/locales/pl.json`

```json
"reminders": {
  ...
  "tabs": {
    "template": "Szablon",
    "assignedCustomers": "Przypisani Klienci"
  },
  "noAssignedCustomers": "Brak klientów przypisanych do tego szablonu"
}
```

## Sekcja techniczna

### Struktura danych klientów z customer_reminders

Tabela `customer_reminders` zawiera:
- `reminder_template_id` - FK do szablonu
- `customer_name`, `customer_phone` - dane klienta
- `vehicle_plate` - pojazd

Zapytanie do pobrania unikalnych klientów:
```typescript
const { data } = await supabase
  .from('customer_reminders')
  .select('customer_name, customer_phone')
  .eq('reminder_template_id', templateId)
  .eq('instance_id', instanceId);

// Deduplikacja po phone
const uniqueCustomers = [...new Map(
  data.map(c => [c.customer_phone, c])
).values()];
```

### Integracja z CustomerEditDrawer

Wykorzystamy istniejący `CustomerEditDrawer`:
```tsx
<CustomerEditDrawer
  customer={selectedCustomer} // lub tymczasowy obiekt z phone/name
  instanceId={instanceId}
  open={!!selectedCustomer}
  onClose={() => setSelectedCustomer(null)}
/>
```

Jeśli klient nie istnieje w `customers` (tylko w `customer_reminders`), tworzymy tymczasowy obiekt jak w `ReservationDetailsDrawer`:
```typescript
const tempCustomer = {
  id: '',
  name: reminder.customer_name,
  phone: reminder.customer_phone,
  email: null,
  notes: null,
  source: 'myjnia'
};
```

### Pliki do utworzenia/modyfikacji

| Plik | Akcja |
|------|-------|
| `src/components/admin/CustomersList.tsx` | Nowy |
| `src/components/admin/TemplateAssignedCustomers.tsx` | Nowy |
| `src/pages/ReminderTemplateEditPage.tsx` | Modyfikacja |
| `src/i18n/locales/pl.json` | Modyfikacja |

### Refaktoryzacja CustomersView

Po utworzeniu `CustomersList.tsx`, `CustomersView.tsx` może go wykorzystać:
```tsx
// CustomersView.tsx
import { CustomersList } from './CustomersList';

const renderCustomerList = () => (
  <CustomersList
    customers={paginatedCustomers}
    vehicles={vehicles}
    instanceId={instanceId}
    onCustomerClick={(c) => setSelectedCustomer(c)}
    showActions
  />
);
```

To jest opcjonalna refaktoryzacja - można zachować obecny kod w CustomersView i tylko nowy komponent używać w TemplateAssignedCustomers.
