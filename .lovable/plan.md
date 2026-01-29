# Plan: Naprawa skakania sidebara dla admin/employee - WYKONANY ✅

## Wykonane zmiany

### Faza 1: Usunięcie setTimeout z MobileBottomNav ✅
**Plik:** `src/components/admin/MobileBottomNav.tsx`
- Usunięto `setTimeout` z `handleMoreMenuItemClick` - teraz nawigacja jest synchroniczna

### Faza 2: Naprawa routingu subdomen admin ✅
**Plik:** `src/App.tsx` - `InstanceAdminRoutes`
- Usunięto osobny `/admin` route (nie potrzebny na subdomenach)
- Usunięto konfliktujący `/` route z `RoleBasedRedirect`
- Użyto `/:view?` (opcjonalny param) zamiast osobnych `/` i `/:view`
- Przeniesiono public routes (`/offers/:token`, `/protocols/:token`) PRZED catch-all

### Faza 3: Poprawka setCurrentView w AdminDashboard ✅
**Plik:** `src/pages/AdminDashboard.tsx`
- Dodano rozróżnienie między subdomain mode (pusty `adminBasePath`) a dev mode (`/admin` prefix)
- Kalendarz na subdomenach: `/`
- Inne widoki na subdomenach: `/{view}`
- Kalendarz w dev mode: `/admin`
- Inne widoki w dev mode: `/admin/{view}`

---

## Oczekiwane rezultaty

1. **Admin/Employee**: Płynna nawigacja między widokami bez skakania
2. **Hall**: Działa jak dotychczas (bez zmian)
3. **Mobile**: Menu "Więcej" działa natychmiast bez opóźnień
4. **URL**: Poprawne ścieżki:
   - Subdomena: `/` (kalendarz), `/customers`, `/offers`, `/halls/1`
   - Dev: `/admin` (kalendarz), `/admin/customers`, `/admin/offers`
