

# Plan: Naprawa skakania sidebara dla admin/employee + separacja komponentów per rola

## Zidentyfikowane przyczyny problemów

### 1. setTimeout w MobileBottomNav (wciąż obecny!)
**Lokalizacja:** `src/components/admin/MobileBottomNav.tsx` linie 47-51
```typescript
const handleMoreMenuItemClick = (view: ViewType) => {
  setMoreMenuOpen(false);
  // Delay view change to allow sheet to close first
  setTimeout(() => {
    onViewChange(view);
  }, 100);
};
```
**Problem:** Race condition - sheet może nie zdążyć się zamknąć zanim nastąpi nawigacja, lub nawigacja może być opóźniona powodując niespójny stan.

### 2. Konflikt routingu na subdomenach admin
**Lokalizacja:** `src/App.tsx` linie 126-154
```typescript
// Problem: oba te route'y prowadzą do różnych komponentów na tym samym URL!
<Route path="/" element={<RoleBasedRedirect />} />
<Route path="/:view" element={<AdminDashboard />} />
```
**Problem:** 
- Dla admin/employee po nawigacji do `/` → `RoleBasedRedirect` przekierowuje na `/admin`
- Ale `/admin` znowu renderuje `AdminDashboard` który ma `currentView = 'calendar'`
- `setCurrentView('calendar')` nawiguje do `/` → cykl!

### 3. Brak wspólnego Layout wrappera
**Problem:** `AdminDashboard` jest montowany na nowo przy każdej zmianie route'a, co resetuje lokalny stan (sidebar, loading states).

---

## Rozwiązanie

### Faza 1: Usunięcie setTimeout z MobileBottomNav

**Plik:** `src/components/admin/MobileBottomNav.tsx`

Zamiana:
```typescript
// PRZED:
const handleMoreMenuItemClick = (view: ViewType) => {
  setMoreMenuOpen(false);
  setTimeout(() => {
    onViewChange(view);
  }, 100);
};

// PO:
const handleMoreMenuItemClick = (view: ViewType) => {
  setMoreMenuOpen(false);
  onViewChange(view);
};
```

### Faza 2: Naprawa routingu subdomen admin

**Plik:** `src/App.tsx` - `InstanceAdminRoutes`

Zmiana struktury:
```typescript
const InstanceAdminRoutes = ({ subdomain }: { subdomain: string }) => (
  <Routes>
    {/* Login page - must be first */}
    <Route path="/login" element={<InstanceAuth subdomainSlug={subdomain} />} />
    
    {/* Public routes - BEFORE catch-all */}
    <Route path="/offers/:token" element={<PublicOfferView />} />
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    
    {/* Role-based redirect - ONLY for /dashboard */}
    <Route path="/dashboard" element={<RoleBasedRedirect />} />
    
    {/* Hall view - specific route BEFORE catch-all */}
    <Route path="/halls/:hallId" element={
      <ProtectedRoute requiredRole="admin">
        <HallView />
      </ProtectedRoute>
    } />
    
    {/* Admin dashboard with optional view param */}
    <Route path="/:view?" element={
      <ProtectedRoute requiredRole="admin">
        <AdminDashboard />
      </ProtectedRoute>
    } />
    
    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
```

**Kluczowe zmiany:**
1. Usunięcie osobnego `/admin` route (nie potrzebny na subdomenach)
2. Użycie `/:view?` (opcjonalny param) zamiast osobnych `/` i `/:view`
3. Przeniesienie public routes PRZED catch-all

### Faza 3: Poprawka setCurrentView w AdminDashboard

**Plik:** `src/pages/AdminDashboard.tsx`

Zmiana logiki nawigacji aby działała poprawnie na subdomenach:
```typescript
const setCurrentView = (newView: ViewType) => {
  // For subdomain mode: empty adminBasePath means we're on *.admin.n2wash.com
  // Calendar should be at '/' and views at '/:view'
  if (!adminBasePath) {
    // Subdomain mode
    const target = newView === 'calendar' ? '/' : `/${newView}`;
    navigate(target, { replace: true });
  } else {
    // Dev mode with /admin prefix
    const target = newView === 'calendar' ? adminBasePath : `${adminBasePath}/${newView}`;
    navigate(target, { replace: true });
  }
};
```

### Faza 4 (opcjonalna): Separacja sidebar komponentów per rola

**Nowe pliki:**
- `src/components/admin/sidebar/AdminSidebar.tsx` - sidebar dla admin/employee
- `src/components/admin/sidebar/HallSidebar.tsx` - uproszczony sidebar dla hall

**Korzyści:**
- Czytelniejszy kod
- Łatwiejsze testowanie per rola
- Eliminacja warunkowych renderów w jednym komponencie
- Mniejsze ryzyko regresji przy zmianach

---

## Podsumowanie zmian w plikach

| Plik | Zmiany |
|------|--------|
| `src/components/admin/MobileBottomNav.tsx` | Usunięcie `setTimeout` z `handleMoreMenuItemClick` |
| `src/App.tsx` | Refaktor `InstanceAdminRoutes`: użycie `/:view?`, kolejność routes |
| `src/pages/AdminDashboard.tsx` | Poprawka `setCurrentView` dla pustego `adminBasePath` |

---

## Oczekiwane rezultaty

1. **Admin/Employee**: Płynna nawigacja między widokami bez skakania
2. **Hall**: Działa jak dotychczas (bez zmian)
3. **Mobile**: Menu "Więcej" działa natychmiast bez opóźnień
4. **URL**: Poprawne ścieżki:
   - Subdomena: `/` (kalendarz), `/customers`, `/offers`, `/halls/1`
   - Dev: `/admin` (kalendarz), `/admin/customers`, `/admin/offers`

