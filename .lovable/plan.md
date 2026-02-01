
# Plan: Poprawki tabeli pracowników - layout i widoczność

## Podsumowanie problemów

Na podstawie screena i opisu:
1. **Scroll poziomy** - tabela ma nadal scroll, nie widać całej sumy wypłat
2. **Imiona niewidoczne** - kolumna imion jest za wąska (tylko "I" lub "." widoczne)
3. **Czas - format** - zmienić na godziny nad minutami (wertykalnie)
4. **Suma wypłat** - ma być wyrównana pod kolumną kwot jak podsumowanie
5. **Ołówek edycji** - usunąć z tabeli, przenieść do WorkerTimeDialog (ale nie na hall view)

---

## Zmiany w EmployeesView.tsx

### 1. Nowy layout kolumn z fixed widths

Zmienić z `table-fixed` na zwykłą tabelę z określonymi szerokościami kolumn:

```typescript
// Struktura kolumn:
// [Avatar + Imię] [Czas]  [Kwota]
// flex-1           w-20    w-24
```

### 2. Usunięcie ołówka z tabeli

Usunąć całą sekcję z przyciskiem edycji z wiersza tabeli (linie 485-492).

### 3. Czas - format wertykalny (godziny nad minutami)

Zmienić wyświetlanie z `"0h 13min"` na:
```
0h
13min
```

```typescript
// Zmiana formatMinutesToTime lub inline display:
const hours = Math.floor(displayMinutes / 60);
const mins = displayMinutes % 60;

// W TableCell:
<TableCell className="w-20 text-center">
  <div className="text-sm">
    {hours > 0 && <div>{hours}h</div>}
    <div>{mins}min</div>
  </div>
</TableCell>
```

### 4. Suma wypłat - wyrównanie pod kwotami

Zmienić strukturę TableFooter - usunąć `colSpan={2}` i dać sumę tylko w ostatniej kolumnie:

```typescript
<TableFooter className="bg-white">
  <TableRow>
    <TableCell></TableCell>
    <TableCell></TableCell>
    <TableCell className="text-right font-bold text-sm">
      Suma wypłat {periodLabel}:
      <br />
      {totalEarnings} zł
    </TableCell>
  </TableRow>
</TableFooter>
```

### 5. Poprawa szerokości kolumny imienia

Usunąć `max-w-0` z TableCell imienia i dać `flex-1` aby zajęła całą dostępną przestrzeń:

```typescript
<TableCell className="py-3">
  <div className="flex items-center gap-2">
    <Avatar className="h-8 w-8 flex-shrink-0">...</Avatar>
    <span className="font-medium truncate">{employee.name}</span>
  </div>
</TableCell>
<TableCell className="w-16 text-center py-3">...</TableCell>
<TableCell className="w-20 text-right py-3">...</TableCell>
```

---

## Zmiany w WorkerTimeDialog.tsx

### Dodanie przycisku edycji obok imienia

Dodać przycisk ołówka obok imienia pracownika w dialogu (tylko dla admina, nie na hall view):

```typescript
// Dodać props:
interface WorkerTimeDialogProps {
  ...
  showEditButton?: boolean;  // default true
  onEditEmployee?: () => void;
}

// Obok imienia:
<div className="flex items-center gap-2">
  <h2 className="text-lg font-semibold">{employee.name}</h2>
  {showEditButton && onEditEmployee && (
    <button onClick={onEditEmployee} className="p-1 rounded hover:bg-muted">
      <Pencil className="w-4 h-4 text-muted-foreground" />
    </button>
  )}
</div>
```

### Przekazanie propsów z EmployeesView.tsx

```typescript
<WorkerTimeDialog
  open={!!workerDialogEmployee}
  onOpenChange={(open) => !open && setWorkerDialogEmployee(null)}
  employee={workerDialogEmployee}
  instanceId={instanceId}
  showEditButton={isAdmin}
  onEditEmployee={() => {
    setEditingEmployee(workerDialogEmployee);
    setDialogOpen(true);
  }}
/>
```

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `EmployeesView.tsx` | Nowy layout kolumn, format czasu wertykalny, suma pod kwotami, usunięty ołówek |
| `WorkerTimeDialog.tsx` | Dodany przycisk edycji obok imienia (opcjonalny) |

---

## Wizualizacja po zmianach

### Tabela:
```text
┌────────────────────────────────────────────┐
│ [IW] Iwona           0h      6.50 zł       │
│                     13min                  │
├────────────────────────────────────────────┤
│ [JA] Janek           8h         -          │
│                     52min                  │
├────────────────────────────────────────────┤
│ [R] Rusland          0h      1.67 zł       │
│                      2min                  │
├────────────────────────────────────────────┤
│                           Suma wypłat luty:│
│                               8.17 zł      │
└────────────────────────────────────────────┘
```

### WorkerTimeDialog z edycją:
```text
┌─────────────────────────────────────┐
│            [Avatar]                 │
│         Iwona  ✏️                   │  ← ołówek obok imienia
│         Dzisiaj: 13 min             │
│                                     │
│       [    START    ]               │
│       [  Zobacz grafik  ]           │
└─────────────────────────────────────┘
```
