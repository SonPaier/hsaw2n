
# Plan: Rozszerzenie sekcji "Usługi" w szczegółach rezerwacji

## Podsumowanie zmian

Dodanie szybkiego dodawania i usuwania usług bezpośrednio z widoku szczegółów rezerwacji (bez wchodzenia w tryb edycji).

## Zmiany wizualne

1. **Większe pills usług** - z `px-2 py-0.5 text-xs` na `px-3 py-1.5 text-sm`
2. **Każdy pill z ikoną X** - kliknięcie natychmiast usuwa usługę i zapisuje rezerwację
3. **Pill "Dodaj"** - na końcu listy, niebieski (primary) z białym tekstem, otwiera drawer usług
4. **ServiceSelectionDrawer** - usunięcie sekcji "Zaznaczone" z góry drawera

## Architektura

```text
ReservationDetailsDrawer
├── Sekcja "Usługi"
│   ├── Pills z nazwami usług + X (usuwające z instant save)
│   └── Pill "Dodaj" (primary, otwiera ServiceSelectionDrawer)
├── ServiceSelectionDrawer (reużyty komponent)
│   └── onConfirm → instant save do bazy + refresh
```

## Szczegóły techniczne

### 1. Modyfikacja `ReservationDetailsDrawer.tsx`

#### Nowe stany i importy:
```typescript
import ServiceSelectionDrawer, { ServiceWithCategory } from './ServiceSelectionDrawer';

// Nowe stany
const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
const [savingService, setSavingService] = useState(false);
```

#### Funkcja natychmiastowego zapisu usług:
```typescript
const handleAddServices = async (
  newServiceIds: string[], 
  servicesData: ServiceWithCategory[]
) => {
  if (!reservation) return;
  setSavingService(true);
  
  try {
    // Merge existing + new service IDs
    const currentIds = reservation.service_ids || [];
    const mergedIds = [...new Set([...currentIds, ...newServiceIds])];
    
    // Build service_items with prices
    const newItems = newServiceIds.map(id => ({
      service_id: id,
      custom_price: null
    }));
    const existingItems = reservation.service_items || [];
    const mergedItems = [...existingItems, ...newItems];
    
    // Update database
    const { error } = await supabase
      .from('reservations')
      .update({
        service_ids: mergedIds,
        service_items: mergedItems,
      })
      .eq('id', reservation.id);
    
    if (error) throw error;
    toast.success('Usługi dodane');
    
  } catch (error) {
    console.error('Error adding services:', error);
    toast.error('Błąd dodawania usług');
  } finally {
    setSavingService(false);
  }
};

const handleRemoveService = async (serviceId: string) => {
  if (!reservation) return;
  setSavingService(true);
  
  try {
    const currentIds = reservation.service_ids || [];
    const updatedIds = currentIds.filter(id => id !== serviceId);
    const updatedItems = (reservation.service_items || [])
      .filter(item => item.service_id !== serviceId);
    
    const { error } = await supabase
      .from('reservations')
      .update({
        service_ids: updatedIds,
        service_items: updatedItems.length > 0 ? updatedItems : null,
      })
      .eq('id', reservation.id);
    
    if (error) throw error;
    toast.success('Usługa usunięta');
    
  } catch (error) {
    console.error('Error removing service:', error);
    toast.error('Błąd usuwania usługi');
  } finally {
    setSavingService(false);
  }
};
```

#### Nowy wygląd sekcji usług (linie ~564-585):
```tsx
{/* Services */}
{(reservation.services_data && reservation.services_data.length > 0) || reservation.service ? (
  <div className="flex items-start gap-3">
    <div className="w-5 h-5 flex items-center justify-center text-primary font-bold text-sm mt-1">U</div>
    <div className="flex-1">
      <div className="text-xs text-muted-foreground">{t('reservations.services')}</div>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {/* Existing services with X button */}
        {reservation.services_data?.map((svc, idx) => (
          <span 
            key={svc.id || idx} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/90 text-white rounded-full text-sm font-medium group"
          >
            {svc.name}
            <button
              type="button"
              onClick={() => svc.id && handleRemoveService(svc.id)}
              disabled={savingService || !svc.id}
              className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        
        {/* Add button pill */}
        <button
          type="button"
          onClick={() => setServiceDrawerOpen(true)}
          disabled={savingService}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </button>
      </div>
    </div>
  </div>
) : (
  /* Show only Add button when no services */
  <div className="flex items-start gap-3">
    <div className="w-5 h-5 flex items-center justify-center text-primary font-bold text-sm mt-1">U</div>
    <div>
      <div className="text-xs text-muted-foreground">{t('reservations.services')}</div>
      <button
        type="button"
        onClick={() => setServiceDrawerOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {t('common.add')}
      </button>
    </div>
  </div>
)}
```

#### Dodanie ServiceSelectionDrawer (przed zamknięciem komponentu):
```tsx
{/* Quick Service Selection Drawer */}
<ServiceSelectionDrawer
  open={serviceDrawerOpen}
  onClose={() => setServiceDrawerOpen(false)}
  instanceId={reservation?.instance_id || ''}
  carSize={carSize || 'medium'}
  selectedServiceIds={reservation?.service_ids || []}
  hasUnifiedServices={reservation?.has_unified_services ?? true}
  hideSelectedSection={true}  // Nowy prop!
  onConfirm={(serviceIds, duration, servicesData) => {
    // Filter only NEW services (not already in reservation)
    const currentIds = reservation?.service_ids || [];
    const newIds = serviceIds.filter(id => !currentIds.includes(id));
    if (newIds.length > 0) {
      handleAddServices(newIds, servicesData);
    }
    setServiceDrawerOpen(false);
  }}
/>
```

### 2. Modyfikacja `ServiceSelectionDrawer.tsx`

#### Nowy prop:
```typescript
interface ServiceSelectionDrawerProps {
  // ... existing props
  /** Hide the "Zaznaczone" selected services section */
  hideSelectedSection?: boolean;
}
```

#### Ukrycie sekcji "Zaznaczone" (linie ~488-508):
```tsx
{/* Selected Services Chips - conditionally hidden */}
{!hideSelectedSection && selectedServices.length > 0 && (
  <div className="space-y-1.5">
    <p className="text-xs text-muted-foreground font-medium">
      {t('serviceDrawer.selectedServices')} ({selectedServices.length})
    </p>
    {/* ... rest of chips */}
  </div>
)}
```

### 3. Aktualizacja wersji

Podniesienie wersji do `01.27.06` w `public/version.json`.

## Pliki do modyfikacji

1. `src/components/admin/ReservationDetailsDrawer.tsx` - główna logika
2. `src/components/admin/ServiceSelectionDrawer.tsx` - nowy prop `hideSelectedSection`
3. `public/version.json` - wersja

## Podsumowanie UX

- **Dodawanie usług**: Klik "Dodaj" → Drawer z listą usług → Wybór → Natychmiastowy zapis
- **Usuwanie usług**: Klik X na pillu → Natychmiastowy zapis
- **Pills większe**: Lepiej widoczne na ekranach dotykowych (py-1.5 zamiast py-0.5)
- **Sekcja "Zaznaczone" ukryta**: Czystszy widok w drawerze, mniej redundancji
