
# Plan: Naprawienie skakania sidebara dla admina

## Zdiagnozowane problemy

### 1. Konflikt routingu w `InstanceAdminRoutes`
Route `/:view` jest zbyt ogólny i koliduje z `/halls/:hallId`. Gdy użytkownik nawiguje do widoku np. "offers", może być błędnie dopasowany.

### 2. Logika `setCurrentView` z pustym `adminBasePath`
W `AdminDashboard.tsx` (linia 154-158):
```typescript
const setCurrentView = (newView: ViewType) => {
  const target =
    newView === 'calendar' ? adminBasePath || '/' : `${adminBasePath}/${newView}`;
  navigate(target);
};
```
Gdy `adminBasePath` jest pusty (na subdomenach instancji jak `armcar.admin.n2wash.com`), nawigacja do kalendarza prowadzi do `/`, co może być niepoprawnie interpretowane przez router.

### 3. `setTimeout` w przyciskach sidebara
Przyciski używają `setTimeout(() => setCurrentView(...), 50)` co może powodować race conditions i niespójne stany podczas szybkiego klikania.

### 4. Brak wczesnego guardu dla roli `hall` na `/admin`
Użytkownik `hall` wchodzący na `/admin` powinien być natychmiast przekierowany do `/halls/:hallId`, ale obecnie renderuje `AdminDashboard` z ograniczonym UI.

---

## Rozwiązanie

### Zmiana 1: Usunięcie `setTimeout` z przycisków sidebara (AdminDashboard.tsx)

Obecny kod:
```typescript
onClick={() => { setSidebarOpen(false); setTimeout(() => setCurrentView('calendar'), 50); }}
```

Nowy kod:
```typescript
onClick={() => { setSidebarOpen(false); setCurrentView('calendar'); }}
```

**Dotyczy wszystkich przycisków nawigacji w sidebarze** (linie ~2293-2353).

### Zmiana 2: Poprawienie `setCurrentView` dla pustego `adminBasePath`

Obecny kod (linia 154-158):
```typescript
const setCurrentView = (newView: ViewType) => {
  const target =
    newView === 'calendar' ? adminBasePath || '/' : `${adminBasePath}/${newView}`;
  navigate(target);
};
```

Nowy kod:
```typescript
const setCurrentView = (newView: ViewType) => {
  // For subdomain mode (empty adminBasePath), calendar is at root '/'
  // For /admin prefix mode, calendar is at '/admin'
  const calendarPath = adminBasePath || '/';
  const target = newView === 'calendar' ? calendarPath : `${adminBasePath}/${newView}`;
  navigate(target, { replace: true }); // replace: true prevents history stack buildup
};
```

### Zmiana 3: Dodanie przekierowania roli `hall` do HallView

Dodać nowy `useEffect` po `fetchUserInstanceId`:

```typescript
// Redirect hall role to HallView - they shouldn't be on AdminDashboard
useEffect(() => {
  if (userRole === 'hall' && instanceId) {
    const hallPath = adminBasePath ? '/admin/halls/1' : '/halls/1';
    navigate(hallPath, { replace: true });
  }
}, [userRole, instanceId, navigate, adminBasePath]);
```

I wczesny guard przed głównym renderem:
```typescript
// If hall role detected, show loader while redirecting
if (userRole === 'hall') {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
```

---

## Podsumowanie zmian w plikach

| Plik | Zmiany |
|------|--------|
| `src/pages/AdminDashboard.tsx` | 1. Usunięcie `setTimeout` z ~10 przycisków sidebara<br>2. Poprawienie `setCurrentView` z `replace: true`<br>3. Dodanie `useEffect` przekierowującego rolę `hall`<br>4. Dodanie wczesnego guardu przed renderem dla roli `hall`<br>5. Import `Loader2` |

---

## Oczekiwane rezultaty

1. **Admin/Employee**: Sidebar działa płynnie bez skakania, nawigacja między widokami jest natychmiastowa
2. **Hall**: Automatyczne przekierowanie do `/halls/1` gdy wejdą na `/admin`
3. **Historia przeglądarki**: Brak nadmiarowych wpisów dzięki `replace: true`
4. **Nagłówek**: Prawidłowo wyświetla logo i nazwę instancji (nie "Panel admina")
