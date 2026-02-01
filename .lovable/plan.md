
# Plan: Poprawki UI w widoku Pracowników i dialogu edycji

## Podsumowanie zmian

Zestaw poprawek wizualnych i UX dla widoku pracowników (`EmployeesView.tsx`) oraz dialogu edycji pracownika (`AddEditEmployeeDialog.tsx`).

---

## 1. EmployeesView.tsx - Poprawki tabeli i layoutu

### 1.1 Większy padding na mobile (nieobecności pod bottom menu)
**Problem:** Sekcja nieobecności wchodzi pod dolne menu na mobile.

**Rozwiązanie:** Dodać `pb-24` (96px) do głównego kontenera, aby zapewnić przestrzeń powyżej bottom menu (który ma ~72px wysokości):
```typescript
// Linia 389:
<div className="space-y-6 pb-24">
```

### 1.2 Tabela z białym tłem + usunięcie nagłówków
**Zmiany:**
- Dodać białe tło do tabeli: `className="bg-white rounded-lg"`
- Usunąć sekcję `<TableHeader>` z nagłówkami "Pracownik", "Czas", "Kwota"

```typescript
<Table className="bg-white rounded-lg">
  {/* Usunięty TableHeader */}
  <TableBody>
    ...
  </TableBody>
</Table>
```

### 1.3 Footer z sumą wypłat - w 1 linii + białe tło
**Zmiany:**
- Dodać `whitespace-nowrap` aby tekst był w jednej linii
- Dodać białe tło do całego footera

```typescript
<TableFooter className="bg-white">
  <TableRow>
    <TableCell colSpan={2}></TableCell>
    <TableCell className="text-right font-bold whitespace-nowrap">
      Suma wypłat {periodLabel}: {totalEarnings} zł
    </TableCell>
  </TableRow>
</TableFooter>
```

### 1.4 Przycisk Settings z border i białym tłem
```typescript
<Button 
  onClick={() => setSettingsDrawerOpen(true)} 
  variant="outline" 
  size="icon"
  className="bg-white"
  title="Ustawienia czasu pracy"
>
  <Settings2 className="w-5 h-5" />
</Button>
```

### 1.5 Przyciski nawigacji miesiąc/tydzień z białym tłem
```typescript
<Button variant="outline" size="icon" onClick={handlePrevPeriod} className="bg-white">
  <ChevronLeft className="w-4 h-4" />
</Button>
...
<Button variant="outline" size="icon" onClick={handleNextPeriod} className="bg-white">
  <ChevronRight className="w-4 h-4" />
</Button>
```

---

## 2. AddEditEmployeeDialog.tsx - Poprawki UX

### 2.1 Zmiana label "Stawka godzinowa"
```typescript
// Linia 224:
<Label htmlFor="rate">Stawka godzinowa na rękę (zł)</Label>
```

### 2.2 Nowy układ przycisków w DialogFooter
**Układ:** `[🗑️ czerwona ikonka] [Anuluj - białe tło] [Zapisz]`
- Wszystkie przyciski w jednej linii
- Usuń po lewej - tylko ikonka śmietnika (czerwona)
- Anuluj - białe tło, po środku
- Zapisz - po prawej

```typescript
<DialogFooter className="flex flex-row items-center gap-2">
  {isEditing && isAdmin && (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={() => setDeleteConfirmOpen(true)}
      disabled={isDeleting}
      className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
    >
      <Trash2 className="w-5 h-5" />
    </Button>
  )}
  <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-white">
    Anuluj
  </Button>
  <Button onClick={handleSubmit} disabled={isSubmitting}>
    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
    {isEditing ? 'Zapisz' : 'Dodaj'}
  </Button>
</DialogFooter>
```

---

## Podsumowanie zmian w plikach

| Plik | Zmiana |
|------|--------|
| `EmployeesView.tsx` | pb-24, białe tła (tabela, footer, przyciski), usunięte nagłówki, suma w 1 linii |
| `AddEditEmployeeDialog.tsx` | Nowy label stawki, układ przycisków w 1 linii |

---

## Wizualizacja po zmianach

### Tabela pracowników (mobile):
```text
┌─────────────────────────────────────┐ ← białe tło
│ [IW] Iwona ✏️     0h 13min   6.50 zł│
│ [JA] Janek ✏️     8h 30min       -  │
│ [RU] Rusland ✏️   0h 2min    1.67 zł│
├─────────────────────────────────────┤
│           Suma wypłat luty: 8,17 zł │ ← białe tło, 1 linia
└─────────────────────────────────────┘

  Nieobecności
  ┌─────────────────────────────────┐
  │ [IW] Iwona                      │
  │ 12 - 14.02                      │
  └─────────────────────────────────┘
  
  ← pb-24 zapewnia przestrzeń nad bottom menu
```

### Dialog edycji (przyciski):
```text
┌─────────────────────────────────────┐
│ 🗑️        │  Anuluj  │   Zapisz    │
│ czerwona  │ białe tło│   primary   │
│ ikonka    │          │             │
└─────────────────────────────────────┘
```
