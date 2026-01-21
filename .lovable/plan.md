
# Plan naprawy: Lista usług nie wyświetla się przy pierwszym otwarciu edycji

## Problem
Race condition między useEffect pobierającym usługi a useEffect inicjalizującym formularz edycji. Przy pierwszym otwarciu `services[]` jest puste, więc lista usług nie może się załadować.

## Rozwiązanie

### Zmiana 1: Dodaj dedykowany useEffect do mapowania usług

Dodaj NOWY useEffect, który uruchomi się po załadowaniu `services`, gdy dialog jest w trybie edycji:

```typescript
// NEW: Re-map servicesWithCategory when services are loaded (for edit mode)
useEffect(() => {
  if (!open || !editingReservation || services.length === 0) return;
  
  // Skip if servicesWithCategory is already populated
  if (servicesWithCategory.length > 0) return;
  
  const serviceIds = (editingReservation.service_ids && editingReservation.service_ids.length > 0) 
    ? editingReservation.service_ids 
    : (editingReservation.service_id ? [editingReservation.service_id] : []);
  
  if (serviceIds.length === 0) return;
  
  const loadedServicesWithCategory: ServiceWithCategory[] = [];
  serviceIds.forEach(id => {
    const service = services.find(s => s.id === id);
    if (service) {
      loadedServicesWithCategory.push({
        id: service.id,
        name: service.name,
        shortcut: service.shortcut,
        category_id: service.category_id,
        duration_minutes: service.duration_minutes,
        duration_small: service.duration_small,
        duration_medium: service.duration_medium,
        duration_large: service.duration_large,
        price_from: service.price_from,
        price_small: service.price_small,
        price_medium: service.price_medium,
        price_large: service.price_large,
        category_prices_are_net: false,
      });
    }
  });
  
  if (loadedServicesWithCategory.length > 0) {
    setServicesWithCategory(loadedServicesWithCategory);
  }
}, [open, services, editingReservation]);
```

**Lokalizacja**: Dodaj po linii ~738 (po głównym useEffect resetującym formularz)

### Zmiana 2: Analogiczna zmiana dla trybu PPF/Detailing

Ten sam useEffect powinien obsługiwać też tryb `isPPFOrDetailingMode`, ponieważ tam jest identyczny problem.

### Zmiana 3: Reset servicesWithCategory przy zamknięciu

Upewnij się, że `servicesWithCategory` jest czyszczone przy zamknięciu dialogu (w else bloku przy `open = false`):

```typescript
} else {
  // Dialog closed - reset tracking refs
  wasOpenRef.current = false;
  isUserEditingRef.current = false;
  lastEditingReservationIdRef.current = null;
  setServicesWithCategory([]); // <-- DODAJ
}
```

## Edytowane pliki

| Plik | Zmiana |
|------|--------|
| `src/components/admin/AddReservationDialogV2.tsx` | Nowy useEffect do mapowania usług po załadowaniu services + reset przy zamknięciu |

## Dlaczego to zadziała

1. Przy pierwszym otwarciu: główny useEffect wykonuje się z pustym `services[]`
2. Fetch usług kończy się → `services` zostaje wypełnione
3. NOWY useEffect reaguje na zmianę `services` i mapuje usługi do `servicesWithCategory`
4. Lista usług wyświetla się poprawnie
5. Przy zamknięciu `servicesWithCategory` jest resetowane, więc warunek `servicesWithCategory.length > 0` nie blokuje ponownego mapowania przy następnym otwarciu

## Dodatkowe uwagi

- Warunek `if (servicesWithCategory.length > 0) return;` zapobiega nadpisaniu danych, jeśli użytkownik już ręcznie edytował usługi
- To rozwiązanie jest kompatybilne wstecz i nie wpływa na tryb tworzenia nowej rezerwacji
