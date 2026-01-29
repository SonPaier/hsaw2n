

# Plan: Przypisanie użytkownika hall do konkretnej hali

## Problem do rozwiązania
1. **Legacy routes** - `/hall/:hallId` i `/admin/hall/:hallId` do usunięcia
2. **Przekierowanie roli hall** - obecnie `/halls` zamiast `/halls/1`
3. **Wielokrotne konta hall** - jak przypisać różnych użytkowników hall do różnych hal?

---

## Część 1: Usunięcie legacy routes i naprawa przekierowania

### Zmiany w `src/App.tsx`

**DevRoutes - usunięcie legacy route:**
- Usunąć route `/admin/hall/:hallId` (linie 196-202)
- Pozostawić tylko `/admin/halls/:hallId`

**InstanceAdminRoutes:**
- Nie ma legacy `/hall/:hallId` (już poprawione na `/halls/:hallId`)

### Zmiany w `src/components/RoleBasedRedirect.tsx`

Zmienić przekierowanie dla roli `hall` z `/halls` na `/halls/1`:

```text
Linia 30:
Przed: return <Navigate to="/halls" replace />;
Po:    return <Navigate to="/halls/1" replace />;
```

---

## Część 2: Dynamiczne przypisanie użytkownika hall do konkretnej hali

### Proponowane rozwiązanie: Dodać kolumnę `hall_id` do `user_roles`

**Zalety:**
- Minimalna zmiana schematu
- Nie łamie istniejących ról (admin, employee, super_admin)
- Prosta logika: jeśli rola = 'hall' i hall_id jest ustawione → użyj tego hall_id

**Schemat:**
```text
user_roles
├── id (uuid)
├── user_id (uuid)
├── role (enum: admin, employee, hall, super_admin, user)
├── instance_id (uuid, nullable)
└── hall_id (uuid, nullable) ← NOWE POLE
```

### Migracja bazy danych
```sql
ALTER TABLE user_roles 
ADD COLUMN hall_id uuid REFERENCES halls(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_roles.hall_id IS 
  'Przypisanie do konkretnej hali dla roli hall (kiosk mode)';
```

### Zmiany w `RoleBasedRedirect.tsx`

```text
// Jeśli rola hall ma przypisany hall_id, przekieruj do tej hali
// W przeciwnym razie użyj domyślnej /halls/1

const hallRole = roles.find(r => r.role === 'hall');
if (hallRole) {
  if (hallRole.hall_id) {
    // Przekieruj do konkretnej hali (UUID)
    return <Navigate to={`/halls/${hallRole.hall_id}`} replace />;
  }
  // Fallback: pierwsza aktywna hala
  return <Navigate to="/halls/1" replace />;
}
```

### Zmiany w `useAuth.tsx`

Rozszerzyć interfejs `UserRole` o `hall_id`:

```typescript
interface UserRole {
  role: AppRole;
  instance_id: string | null;
  hall_id: string | null;  // ← NOWE POLE
}
```

Zaktualizować `fetchUserRoles`:
```typescript
const { data, error } = await supabase
  .from('user_roles')
  .select('role, instance_id, hall_id')  // ← dodać hall_id
  .eq('user_id', userId);
```

---

## Diagram przepływu

```text
Logowanie użytkownika
        │
        ▼
  RoleBasedRedirect
        │
        ├── role = 'hall'?
        │       │
        │       ├── hall_id ustawiony? ──► /halls/{hall_id} (UUID)
        │       │
        │       └── brak hall_id ──► /halls/1 (pierwsza aktywna)
        │
        ├── role = 'admin' lub 'employee'? ──► /admin
        │
        └── role = 'super_admin'? ──► /super-admin
```

---

## Diagram HallView - obsługa hallId

```text
HallView otrzymuje :hallId z URL
        │
        ├── hallId = UUID? ──► pobierz halę po ID
        │
        └── hallId = numer (1, 2, 3...)? ──► pobierz N-tą aktywną halę
```

HallView już obsługuje oba formaty (linie 174-206), więc nie wymaga zmian.

---

## Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `src/App.tsx` | Usunięcie `/admin/hall/:hallId` z DevRoutes |
| `src/components/RoleBasedRedirect.tsx` | Obsługa `hall_id` + fallback na `/halls/1` |
| `src/hooks/useAuth.tsx` | Dodanie `hall_id` do interfejsu i query |
| **Migracja SQL** | Dodanie kolumny `hall_id` do `user_roles` |

---

## Zarządzanie przypisaniami hal (opcjonalnie - przyszłość)

W panelu admina można dodać edycję przypisania hali przy tworzeniu/edycji użytkownika z rolą `hall`:

- Dialog `AddInstanceUserDialog` / `EditInstanceUserDialog`
- Dropdown z listą aktywnych hal (widoczny tylko gdy rola = 'hall')
- Zapis do `user_roles.hall_id`

---

## Podsumowanie kroków implementacji

1. **Migracja SQL** - dodać kolumnę `hall_id`
2. **useAuth.tsx** - pobierać i eksponować `hall_id`
3. **RoleBasedRedirect.tsx** - używać `hall_id` do przekierowania
4. **App.tsx** - usunąć legacy route `/admin/hall/:hallId`
5. (Opcjonalnie) UI do zarządzania przypisaniami

