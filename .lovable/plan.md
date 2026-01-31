

# Uproszczenie widoku pracowników

## Co zrobimy

### 1. Usunięcie tabeli wpisów czasu pracy
Cała sekcja "Wpisy czasu pracy w tym miesiącu" zostanie usunięta z widoku. Dane o czasie pracy nadal będą widoczne:
- Na kafelku pracownika (suma godzin + kwota)
- W szczegółach po kliknięciu w kafelek (WorkerTimeDialog)

### 2. Lepsze wyświetlanie dni wolnych na kafelkach
Zamiast ogólnych badge'ów typu "Urlop (3d)", pokażemy konkretne daty nieobecności w danym miesiącu:

**Przykład dla Iwony (wolne we wtorek):**
```
Iwona Kowalska            [edytuj]
12:30  •  156,25 zł
Wolne: 4.02 (wt), 11.02 (wt), 18.02 (wt)
```

Dla dłuższych nieobecności (urlopy):
```
Marek Nowak               [edytuj]
8:00  •  100,00 zł
Urlop: 10-14.02
```

---

## Szczegóły techniczne

### Zmiany w pliku `EmployeesView.tsx`

**Usunięcie:**
- Sekcja "Time entries" (linie 271-422)
- Stany i handlery związane z edycją wpisów: `timeEntryDialogOpen`, `editingTimeEntry`, `deleteConfirmOpen`, `entryToDelete`
- Import i użycie `AddEditTimeEntryDialog`, `ConfirmDialog`
- Hook `useDeleteTimeEntry` i logika grupowania `entriesByEmployeeAndDate`

**Modyfikacja wyświetlania dni wolnych:**
Nowa funkcja formatująca dni wolne w bieżącym miesiącu:
```typescript
const formatDaysOffForMonth = (employeeDaysOff: EmployeeDayOff[]) => {
  // Generuje listę dat wolnych w wybranym miesiącu
  // Grupuje po typie nieobecności
  // Zwraca czytelny format: "Wolne: 4.02 (wt), 11.02"
}
```

**Wygląd kafelka (uproszczony):**
```
[Avatar] Imię              [ołówek]
         HH:MM  •  XXX zł
         Urlop: 10-14.02
         Wolne: 4.02 (wt), 11.02
```

