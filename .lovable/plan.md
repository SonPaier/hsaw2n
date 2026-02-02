
# Plan: Rozszerzenie UI rezerwacji i HallView

## Podsumowanie zmian

1. **Szczegół rezerwacji**: Dodanie "Pokaż historię" do dropdown menu dla wszystkich statusów
2. **Tłumaczenie**: Dodanie brakującej etykiety `common.saved`
3. **Przeniesienie Halls**: Usunięcie z głównego sidebara, dodanie jako nowa zakładka w Settings
4. **HallReservationCard**: Przycisk "Usługi" + białe przyciski + usuwanie usług z confirmation
5. **UI karty hali**: Poprawki stylów (godziny bold, samochód czarny, kolejność danych)

---

## 1. Szczegół rezerwacji - Dropdown "Pokaż historię"

### Plik: `src/components/admin/ReservationDetailsDrawer.tsx`

**Obecny stan** (linia ~1144-1151):
Opcja "Zobacz historię" jest w dropdown, ale dropdown jest widoczny tylko w trybie admin (`!isHallMode`).

**Zmiana**:
Nie ma potrzeby zmian - opcja "Zobacz historię" jest już obecna w linii 1144-1150. Trzeba tylko sprawdzić, czy jest dostępna dla wszystkich statusów - i jest.

**Weryfikacja**: Kod pokazuje, że dropdown menu nie jest ograniczony statusem dla opcji "Zobacz historię":
```tsx
<DropdownMenuItem onClick={() => {
  setActionsMenuOpen(false);
  setHistoryDrawerOpen(true);
}}>
  <History className="w-4 h-4 mr-2" />
  Zobacz historię
</DropdownMenuItem>
```

To działa poprawnie - nie wymaga zmian.

---

## 2. Tłumaczenie `common.saved`

### Plik: `src/i18n/locales/pl.json`

**Lokalizacja**: Sekcja `common` (linie 2-57)

**Dodaj**:
```json
"saved": "Zapisano"
```

To rozwiąże brakujące tłumaczenie używane w `ReservationDetailsDrawer.tsx` przy zapisie notatek.

---

## 3. Przeniesienie Halls do Settings

### Architektura zmian:

```text
Było:
├── Sidebar
│   ├── Kalendarz
│   ├── Rezerwacje
│   ├── Klienci
│   ├── Usługi
│   ├── Oferty
│   ├── Hale ← USUŃ
│   ├── Protokoły
│   ├── Pracownicy
│   ├── Powiadomienia
│   └── Ustawienia

Będzie:
├── Sidebar
│   ├── (bez Hale)
│   └── Ustawienia
│       ├── Firma
│       ├── Stanowiska
│       ├── Godziny
│       ├── Hale ← NOWE
│       ├── Aplikacja
│       ├── SMS
│       ├── Użytkownicy
│       └── Widget
```

### Plik: `src/pages/AdminDashboard.tsx`

**Zmiana 1** - Usunięcie z głównej nawigacji (linie ~2350-2353):
```typescript
// USUŃ ten blok:
{hasFeature('hall_view') && <Button variant={currentView === 'halls' ? 'secondary' : 'ghost'} ...>
  <Building2 className="w-4 h-4 shrink-0" />
  {!sidebarCollapsed && t('navigation.halls')}
</Button>}
```

**Zmiana 2** - Usunięcie z renderowania widoku (linia ~2501):
```typescript
// USUŃ:
{currentView === 'halls' && <HallsListView instanceId={instanceId} />}
```

### Plik: `src/components/admin/SettingsView.tsx`

**Zmiana 1** - Nowy typ zakładki (linia ~30):
```typescript
type SettingsTab = 'company' | 'stations' | 'hours' | 'halls' | 'app' | 'sms' | 'users' | 'widget';
```

**Zmiana 2** - Dodaj import HallsListView:
```typescript
import HallsListView from './halls/HallsListView';
```

**Zmiana 3** - Dodaj zakładkę do tablicy tabs (po 'hours', przed 'app', linia ~87):
```typescript
{ key: 'halls', label: t('navigation.halls'), icon: <Building2 className="w-4 h-4" /> },
```

**Zmiana 4** - Renderowanie w switch (po case 'hours', linia ~424):
```typescript
case 'halls':
  return <HallsListView instanceId={instanceId} />;
```

**Zmiana 5** - Warunek widoczności (zakładka widoczna tylko gdy hasFeature('hall_view')):
W tablicy tabs użyć .filter() lub dodać prop instanceId do SettingsView aby przekazać hasFeature.

**Uwaga ważna**: Routing `/halls/:hallId` i `/admin/halls/:hallId` pozostaje bez zmian w `App.tsx` - linki do konkretnych hal nadal działają!

---

## 4. HallReservationCard - Przycisk "Usługi" + zarządzanie

### Plik: `src/components/admin/halls/HallReservationCard.tsx`

#### 4a. Nowe propsy:
```typescript
interface HallReservationCardProps {
  // ... existing props
  onAddService?: (reservation: HallReservationCardProps['reservation']) => void;
  onRemoveService?: (serviceId: string, serviceName: string) => Promise<void>;
}
```

#### 4b. Stany wewnętrzne:
```typescript
const [confirmRemoveService, setConfirmRemoveService] = useState<{ id: string; name: string } | null>(null);
```

#### 4c. Przyciski białe (variant="outline" z białym tłem):
```tsx
<Button
  variant="outline"
  className="flex-1 gap-2 bg-white hover:bg-gray-50"
  onClick={() => onAddProtocol(reservation)}
>
```

#### 4d. Przycisk "Usługi":
```tsx
{onAddService && (
  <Button
    variant="outline"
    className="flex-1 gap-2 bg-white hover:bg-gray-50"
    onClick={() => onAddService(reservation)}
  >
    <Settings2 className="w-5 h-5" />
    Usługi
  </Button>
)}
```

#### 4e. Lista usług z toggle i delete:
```tsx
{services_data.map((service, idx) => {
  const isChecked = service.id && checked_service_ids?.includes(service.id);
  
  return (
    <div key={service.id || idx} className="flex items-center justify-between ...">
      <div 
        className={cn("text-2xl font-bold flex items-center gap-2 flex-1", ...)}
        onClick={canToggle ? () => onServiceToggle(service.id!, !isChecked) : undefined}
      >
        {/* existing toggle logic */}
      </div>
      
      {/* Red trash icon */}
      {onRemoveService && service.id && (
        <button
          onClick={() => setConfirmRemoveService({ id: service.id!, name: service.name })}
          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
})}
```

#### 4f. Confirmation popup dla usuwania:
```tsx
{confirmRemoveService && (
  <ConfirmDialog
    open={!!confirmRemoveService}
    onOpenChange={(open) => !open && setConfirmRemoveService(null)}
    title="Usunąć usługę?"
    description={`Czy na pewno chcesz usunąć "${confirmRemoveService.name}" z tej rezerwacji?`}
    confirmLabel="Usuń"
    variant="destructive"
    onConfirm={async () => {
      await onRemoveService?.(confirmRemoveService.id, confirmRemoveService.name);
      setConfirmRemoveService(null);
    }}
  />
)}
```

### Plik: `src/pages/HallView.tsx`

#### 4g. Nowy stan dla drawer usług:
```typescript
const [serviceDrawerReservation, setServiceDrawerReservation] = useState<Reservation | null>(null);
```

#### 4h. Handler dodawania usług (podobny do ReservationDetailsDrawer):
```typescript
const handleAddServicesToReservation = async (newServiceIds: string[], servicesData: ServiceWithCategory[]) => {
  if (!serviceDrawerReservation) return;
  
  const currentIds = serviceDrawerReservation.service_ids || [];
  const mergedIds = [...new Set([...currentIds, ...newServiceIds])];
  
  // Build full service_items with metadata
  const existingItems = serviceDrawerReservation.service_items || [];
  const newItems = newServiceIds
    .filter(id => !currentIds.includes(id))
    .map(id => {
      const svc = servicesData.find(s => s.id === id);
      return {
        service_id: id,
        name: svc?.name || 'Usługa',
        short_name: svc?.short_name || null,
        custom_price: null,
        price_small: svc?.price_small ?? null,
        price_medium: svc?.price_medium ?? null,
        price_large: svc?.price_large ?? null,
      };
    });
  
  const mergedItems = [...existingItems, ...newItems];
  
  const { error } = await supabase
    .from('reservations')
    .update({ service_ids: mergedIds, service_items: mergedItems })
    .eq('id', serviceDrawerReservation.id);
  
  if (!error) {
    toast.success('Usługi dodane');
  }
};

const handleRemoveServiceFromReservation = async (serviceId: string, serviceName: string) => {
  if (!selectedReservation) return;
  
  const currentIds = selectedReservation.service_ids || [];
  const updatedIds = currentIds.filter(id => id !== serviceId);
  const updatedItems = (selectedReservation.service_items || [])
    .filter(item => (item.service_id || (item as any).id) !== serviceId);
  
  const { error } = await supabase
    .from('reservations')
    .update({ 
      service_ids: updatedIds, 
      service_items: updatedItems.length > 0 ? updatedItems : null 
    })
    .eq('id', selectedReservation.id);
  
  if (!error) {
    toast.success('Usługa usunięta');
  }
};
```

#### 4i. ServiceSelectionDrawer w HallView (przy zamknięciu komponentu):
```tsx
<ServiceSelectionDrawer
  open={!!serviceDrawerReservation}
  onClose={() => setServiceDrawerReservation(null)}
  instanceId={instanceId || ''}
  carSize={(serviceDrawerReservation as any)?.car_size || 'medium'}
  selectedServiceIds={serviceDrawerReservation?.service_ids || []}
  hasUnifiedServices={serviceDrawerReservation?.has_unified_services ?? true}
  hideSelectedSection={true}
  onConfirm={(serviceIds, duration, servicesData) => {
    const currentIds = serviceDrawerReservation?.service_ids || [];
    const newIds = serviceIds.filter(id => !currentIds.includes(id));
    if (newIds.length > 0) {
      handleAddServicesToReservation(newIds, servicesData);
    }
    setServiceDrawerReservation(null);
  }}
/>
```

#### 4j. Przekazanie propsów do HallReservationCard:
```tsx
<HallReservationCard
  // ... existing props
  onAddService={(res) => setServiceDrawerReservation(res as Reservation)}
  onRemoveService={handleRemoveServiceFromReservation}
/>
```

---

## 5. Stylizacja HallReservationCard

### Plik: `src/components/admin/halls/HallReservationCard.tsx`

#### 5a. Data i godziny (linia ~199):
**Było**:
```tsx
<div className="text-[28px] italic text-foreground">
  {formatTimeRange()} · {formatDateRange()}
</div>
```

**Będzie**:
```tsx
<div className="text-[28px] text-foreground">
  <span className="font-bold">{formatTimeRange()}</span>
  <span className="text-muted-foreground"> · {formatDateRange()}</span>
</div>
```

#### 5b. Kolejność: najpierw samochód, potem klient (linie ~203-211):
**Było**:
```tsx
<div className="flex items-baseline gap-4 flex-wrap">
  <span className="text-xl font-bold">
    {customer_name} ({formatPhoneDisplay(customer_phone)})
  </span>
  <span className="text-lg font-semibold text-muted-foreground">
    {vehicle_plate}
  </span>
</div>
```

**Będzie**:
```tsx
<div className="space-y-1">
  <div className="text-xl font-bold text-foreground">
    {vehicle_plate}
  </div>
  <div className="text-lg text-muted-foreground">
    {customer_name}, {formatPhoneDisplay(customer_phone)}
  </div>
</div>
```

---

## Pliki do modyfikacji

1. `src/i18n/locales/pl.json` - dodanie `common.saved`
2. `src/pages/AdminDashboard.tsx` - usunięcie Halls z sidebar
3. `src/components/admin/SettingsView.tsx` - nowa zakładka Halls
4. `src/components/admin/halls/HallReservationCard.tsx` - przyciski białe, przycisk Usługi, stylizacja
5. `src/pages/HallView.tsx` - logika zarządzania usługami z drawer
6. `public/version.json` - aktualizacja wersji

---

## Szczegóły techniczne

### Import ConfirmDialog w HallReservationCard:
```typescript
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
```

### Import ServiceSelectionDrawer w HallView:
```typescript
import ServiceSelectionDrawer, { ServiceWithCategory } from '@/components/admin/ServiceSelectionDrawer';
```

### Import Building2 w SettingsView:
```typescript
import { Building2, Clock, Grid2X2, ... } from 'lucide-react';
```

### RLS - rola "hall" może edytować usługi:
Według memory `security/hall-role-reservation-update-policy`, rola "hall" może aktualizować pola związane z workflow, w tym `checked_service_ids`. Jednak `service_ids` i `service_items` mogą wymagać rozszerzenia polityki RLS. 

**Sprawdzenie**: Jeśli polityka `guard_hall_reservation_update` blokuje te kolumny, trzeba ją rozszerzyć lub użyć funkcji RPC z elevated privileges.

---

## Podsumowanie UX

| Funkcja | Opis |
|---------|------|
| Historia dla wszystkich statusów | Już działa - nie wymaga zmian |
| Tłumaczenie "Zapisano" | Dodanie `common.saved` |
| Halls w Settings | Lepsza organizacja menu, routing bez zmian |
| Przycisk Usługi (biały) | Szybkie zarządzanie usługami z karty hali |
| Usuwanie usług z listy | Czerwona ikonka śmietnika + confirmation |
| Stylizacja karty | Godziny bold, samochód czarny font, klient szary |
