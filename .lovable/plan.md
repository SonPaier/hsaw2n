
# Przeglad planu CRM Sales - potencjalne ryzyka

## 1. ROUTING - Glowne ryzyko: catch-all `/:view?`

**Problem:** W `InstanceAdminRoutes` mamy `/:view?` jako catch-all na linii 152-159. Jesli dodamy `/sales-crm/:view?` PRZED nim (jak w planie), to zadziala poprawnie - React Router dopasowuje od gory do dolu, wiec `/sales-crm/orders` trafi do `SalesDashboard`, a `/calendar` nadal do `AdminDashboard`.

**ALE** w `AdminDashboard` linia 165 jest warunek:
```ts
const currentView = view && validViews.includes(view as ViewType) ? (view as ViewType) : 'calendar';
```
Jesli ktos wejdzie na `/sales-crm` bez nested routingu (tj. React Router dopasuje `/:view?` z `view="sales-crm"`), to `validViews` nie zawiera `"sales-crm"` i wyswietli sie widok `calendar`. To NIE jest problem, bo route `/sales-crm/:view?` bedzie zdefiniowany WYZEJ i przechwyci ten URL. Bezpieczne.

**DevRoutes:** Tu mamy `/admin/:view` (linia 224-231). Trzeba dodac `/admin/sales-crm/:view?` PRZED `/admin/:view` - inaczej `/admin/sales-crm/orders` trafi do `AdminDashboard` z `view="sales-crm"`. Plan to uwzglednia. OK.

**Werdykt: BEZPIECZNE** - pod warunkiem ze route `/sales-crm/:view?` jest zdefiniowany PRZED `/:view?`.

---

## 2. RLS - `can_access_instance` nie zna roli `sales`

**Obecna definicja:**
```sql
SELECT is_super_admin() 
  OR has_instance_role(uid(), 'admin', _instance_id)
  OR has_instance_role(uid(), 'employee', _instance_id)
  OR has_instance_role(uid(), 'hall', _instance_id)
```

User z TYLKO rola `sales` **nie przejdzie** `can_access_instance()`. To znaczy ze:
- Nie zobaczy `customer_reminders`, `reminder_templates`, `offer_reminders` i innych tabel uzywajacych `can_access_instance`
- Na razie to nie problem (szkielet z placeholderami), ale trzeba to naprawic TERAZ, bo user z rola `sales` nie bedzie mogl nawet pobrac danych instancji

Plan uwzglednia aktualizacje `can_access_instance` - to kluczowe i musi byc w migracji.

**Werdykt: WYMAGA NAPRAWY w migracji** (plan to przewiduje)

---

## 3. ProtectedRoute - dodanie `sales` do warunku `requiredRole === 'admin'`

**Obecny warunek (linia 44-46):**
```ts
const hasAccess = hasRole('admin') || hasRole('super_admin') || hasRole('employee') || hasRole('hall');
```

Dodanie `|| hasRole('sales')` sprawi ze user z rola `sales` przejdzie guard `requiredRole="admin"`. To znaczy ze:
- User sales moze wejsc na `/admin` (AdminDashboard) - ale tam i tak zobaczy kalendarz
- To jest OK, bo SalesDashboard tez uzywa tego samego guarda

**Ryzyko:** User z TYLKO rola `sales` moze wejsc na AdminDashboard i zobaczyc kalendarz rezerwacji. Czy to zamierzone?

**Rekomendacja:** Zamiast dodawac `sales` do warunku `requiredRole="admin"`, stworzyc osobny route z `requiredRole="sales"` i dodac obsluge `requiredRole === 'sales'` w ProtectedRoute:
```ts
if (requiredRole === 'sales') {
  const hasAccess = hasRole('sales') || hasRole('admin') || hasRole('super_admin');
  if (!hasAccess) return <Navigate to="/" replace />;
}
```

Ale jesli user sales ma tez role admin - to i tak zobaczy AdminDashboard. Wiec mozna bezpiecznie dodac `sales` do warunku admin i nie ma ryzyka - user z TYLKO sales bedzie redirectowany do `/sales-crm` przez `RoleBasedRedirect`.

**Werdykt: BEZPIECZNE** - user sales-only nigdy nie zobaczy linku do AdminDashboard, a gdyby wpisal URL recznie, zobaczy kalendarz bez danych (RLS i tak go blokuje na danych rezerwacji bo `can_access_instance` jeszcze nie przepuszcza sales... chociaz po migracji juz tak). Mozna rozwazyc bardziej restrykcyjny guard, ale na etapie szkieletu to nie jest krytyczne.

---

## 4. RoleBasedRedirect - priorytet ról

Plan dodaje:
```ts
if (hasSalesRole && !hasStudioAccess) {
  return <Navigate to="/sales-crm" replace />;
}
```

Kolejnosc w planie: hall -> super_admin -> **sales (only)** -> admin/employee.

User z admin + sales trafia do `/admin`. User z TYLKO sales trafia do `/sales-crm`. OK.

**Edge case:** User z employee + sales - plan traktuje go jako "hasStudioAccess" (bo employee jest w warunku). Trafi do `/admin`. Moze przejsc do sales-crm przyciskiem. Poprawne.

**Werdykt: BEZPIECZNE**

---

## 5. Enum migration - `ALTER TYPE ADD VALUE`

`ALTER TYPE app_role ADD VALUE 'sales'` jest nieodwracalny (nie mozna pozniej usunac wartosci z enuma w Postgres). To nie jest problem - to swiadoma decyzja architektoniczna.

**Wazne:** Ten statement NIE moze byc wewnatrz transakcji. Migracja musi to uwzglednic.

**Werdykt: BEZPIECZNE, ale wymaga uwagi przy pisaniu migracji**

---

## 6. AppRole typ w useAuth.tsx

Obecny typ: `'super_admin' | 'admin' | 'user' | 'employee' | 'hall'`
Plan dodaje `| 'sales'`. Zmiana czysto typowa, zero ryzyka.

**Typ w ProtectedRoute.tsx** (linia 6) tez musi byc zaktualizowany - plan tego nie wymienia explicite!

**Werdykt: BEZPIECZNE, ale trzeba pamietac o ProtectedRoute.tsx AppRole**

---

## Podsumowanie

| Obszar | Ryzyko | Status |
|--------|--------|--------|
| Routing (InstanceAdmin) | Niskie | OK - kolejnosc route'ow jest kluczowa |
| Routing (DevRoutes) | Niskie | OK - trzeba dodac PRZED /admin/:view |
| RLS can_access_instance | Srednie | MUSI byc w migracji |
| ProtectedRoute guard | Niskie | OK - user sales-only i tak nie ma linku do studio |
| RoleBasedRedirect | Niskie | OK - logika priorytetow poprawna |
| Enum migration | Brak | Nieodwracalne ale zamierzone |
| AppRole w ProtectedRoute | Brak | Trzeba dodac do planu |

**Konkluzja:** Plan jest bezpieczny. Jedyne krytyczne miejsce to migracja `can_access_instance` - bez niej user sales nie zobaczy zadnych danych. Reszta to zmiany addytywne, ktore nie wplywaja na istniejace sciezki.
