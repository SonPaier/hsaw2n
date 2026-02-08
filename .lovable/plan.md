

# Plan: Ujednolicenie stylu przycisku Dodaj i drawera pracowników

## Podsumowanie

Dwie zmiany:
1. Przycisk "Dodaj" w sekcji pracowników ma wyglądać identycznie jak przycisk "Dodaj" w usługach (niebieski/primary)
2. Drawer wyboru pracowników ma używać designu zgodnego z ServiceSelectionDrawer (okrągłe radio po prawej, separator między pozycjami)

---

## Zmiany

### 1. AssignedEmployeesChips.tsx - styl przycisku Dodaj

**Aktualnie:**
```tsx
<button className="bg-muted hover:bg-muted/80 text-muted-foreground ...">
```

**Zmiana na:**
```tsx
<Button type="button" size="sm" onClick={onAdd} disabled={loading}>
  {loading ? <Loader2 /> : <Plus />}
  Dodaj
</Button>
```

Użycie komponentu `Button` z wariantem primary (domyślny), identycznie jak w `SelectedServicesList.tsx` (linia 261-268).

---

### 2. EmployeeSelectionDrawer.tsx - redesign listy

**Aktualny design:**
- Checkbox po lewej stronie
- Brak separatorów
- Hover na całym wierszu

**Nowy design (zgodny z ServiceSelectionDrawer):**
- Okrągły radio/checkmark po prawej stronie
- Cienka szara linia (`border-b border-border/50`) między pozycjami
- Avatar i imię po lewej
- Highlight na zaznaczonych (`bg-primary/5`)

```text
+------------------------------------------+
| [Avatar] Jan Kowalski                [○] |
+------------------------------------------+  <- border-b border-border/50
| [Avatar] Anna Nowak                  [●] |  <- zaznaczony: bg-primary/5, wypełniony circle
+------------------------------------------+
| [Avatar] Piotr Wiśniewski            [○] |
+------------------------------------------+
```

**Kod nowego wiersza:**
```tsx
<button
  key={employee.id}
  type="button"
  onClick={() => toggleEmployee(employee.id)}
  className={cn(
    "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
    isSelected ? "bg-primary/5" : "hover:bg-muted/30"
  )}
>
  {/* Avatar + name */}
  <Avatar className="w-9 h-9 mr-3">
    {employee.photo_url && <AvatarImage src={employee.photo_url} />}
    <AvatarFallback className="bg-primary/10 text-primary text-sm">
      {getInitials(employee.name)}
    </AvatarFallback>
  </Avatar>
  <span className="flex-1 text-left font-medium">{employee.name}</span>
  
  {/* Radio circle on the right */}
  <div className={cn(
    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
    isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
  )}>
    {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
  </div>
</button>
```

**Usunięcie:**
- Import `Checkbox` z radix (nieużywany)
- Wrapper `<label>` z klasą `rounded-lg` i padding

---

## Pliki do edycji

| Plik | Zmiana |
|------|--------|
| `src/components/admin/AssignedEmployeesChips.tsx` | Zmiana stylu przycisku Dodaj na `<Button size="sm">` |
| `src/components/admin/EmployeeSelectionDrawer.tsx` | Redesign listy: radio po prawej, separator, usunięcie Checkbox |

---

## Szczegóły techniczne

### AssignedEmployeesChips.tsx

**Dodaj import:**
```tsx
import { Button } from '@/components/ui/button';
```

**Zmień przycisk (linia 91-104):**
```tsx
{!readonly && onAdd && (
  <Button
    type="button"
    size="sm"
    onClick={onAdd}
    disabled={loading}
  >
    {loading ? (
      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
    ) : (
      <Plus className="w-4 h-4 mr-1" />
    )}
    Dodaj
  </Button>
)}
```

### EmployeeSelectionDrawer.tsx

**Usunięcie:**
```tsx
// Usuń:
import { Checkbox } from '@/components/ui/checkbox';
```

**Dodaj:**
```tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
```

**Zmiana sekcji listy (linia 127-148):**

Zamień `<div className="space-y-1 py-2">` i wewnętrzną `<label>` na:

```tsx
<div className="py-2">
  {filteredEmployees.map((employee) => {
    const isSelected = localSelectedIds.includes(employee.id);
    return (
      <button
        key={employee.id}
        type="button"
        onClick={() => toggleEmployee(employee.id)}
        className={cn(
          "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
          isSelected ? "bg-primary/5" : "hover:bg-muted/30"
        )}
      >
        <Avatar className="w-9 h-9 mr-3">
          {employee.photo_url ? (
            <AvatarImage src={employee.photo_url} alt={employee.name} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getInitials(employee.name)}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 text-left font-medium">{employee.name}</span>
        
        {/* Radio circle on the right */}
        <div className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          isSelected 
            ? "bg-primary border-primary" 
            : "border-muted-foreground/40"
        )}>
          {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
        </div>
      </button>
    );
  })}
</div>
```

