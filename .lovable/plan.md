

# Plan: Udostępnienie modułu "Hale" dla pracowników

## Cel
Umożliwić użytkownikom z rolą `employee` dostęp do modułu "Hale" (widok kalendarza z ograniczonymi stanowiskami).

## Zakres zmian

### 1. Sidebar w AdminDashboard.tsx
**Plik:** `src/pages/AdminDashboard.tsx`

Zmiana warunku wyświetlania przycisku "Hale" w sidebarze:
- **Przed:** `hasFeature('hall_view') && userRole !== 'employee'`
- **Po:** `hasFeature('hall_view')` (bez ograniczenia dla pracowników)

**Lokalizacja:** Linie ~2303-2307

### 2. Mobile Bottom Navigation
**Plik:** `src/components/admin/MobileBottomNav.tsx`

Zmiana warunku w tablicy `moreMenuItems`:
- **Przed:** `hallViewEnabled && userRole !== 'employee'`
- **Po:** `hallViewEnabled` (bez ograniczenia dla pracowników)

**Lokalizacja:** Linia ~85

### 3. HallView - obsługa roli employee
**Plik:** `src/pages/HallView.tsx`

Dodanie obsługi roli `employee` przy pobieraniu `instanceId`:
- **Przed:** Pobierano tylko dla `admin` i `super_admin`
- **Po:** Dodać fallback dla `employee` z `instance_id`

**Lokalizacja:** Linie ~108-141 (funkcja `fetchUserInstanceId`)

```typescript
// Po sprawdzeniu admin role, dodać:
const employeeRole = rolesData.find(r => r.role === 'employee' && r.instance_id);
if (employeeRole?.instance_id) {
  setInstanceId(employeeRole.instance_id);
  return;
}
```

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `AdminDashboard.tsx` | Usunięcie `userRole !== 'employee'` z warunku dla halls |
| `MobileBottomNav.tsx` | Usunięcie `userRole !== 'employee'` z warunku dla halls |
| `HallView.tsx` | Dodanie obsługi roli `employee` przy pobieraniu instanceId |

## Uwagi
- Moduł "Hale" wyświetla kalendarz z ograniczonymi stanowiskami zdefiniowanymi w konfiguracji hali
- Uprawnienia do akcji (edycja, usuwanie rezerwacji) są kontrolowane przez konfigurację hali (`allowed_actions`), nie przez rolę użytkownika
- Routing jest już poprawny - `ProtectedRoute` z `requiredRole="admin"` pozwala na dostęp dla `employee` (sprawdzone w `ProtectedRoute.tsx` linie 44-48)

