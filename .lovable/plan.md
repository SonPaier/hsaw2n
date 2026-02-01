
# Plan implementacji: Zmiany w module Pracowników, Grafiku oraz Widoku Hali

## Podsumowanie

Zestaw ulepszeń i poprawek dla trzech obszarów systemu:
1. **WeeklySchedule** - Domyślnie zaznaczony dzisiaj, większe nagłówki
2. **WorkerTimeDialog/EmployeesList** - Zamykanie po START, większe fonty, pierwszy slot dnia
3. **HallView** - Naprawa mapowania usług (service_ids jako źródło)
4. **EmployeesView** - Zamiana kart na tabelkę + sekcja urlopów

---

## Szczegółowe zmiany

### 1. WeeklySchedule.tsx - Domyślnie zaznaczony dzisiaj + większe nagłówki

**Zmiany w linii 39-40:**
```typescript
// BYŁO:
const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

// BĘDZIE:
const [editingCell, setEditingCell] = useState<EditingCell | null>(() => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return {
    date: todayStr,
    hours: '0',
    minutes: '0',
  };
});
```

**useEffect do aktualizacji godzin po załadowaniu danych (dodaj po linii 61):**
```typescript
// Update editing cell with actual data when time entries load
useEffect(() => {
  if (editingCell && timeEntries.length > 0) {
    const existing = minutesByDate.get(editingCell.date);
    const totalMinutes = existing?.totalMinutes || 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setEditingCell(prev => prev ? {
      ...prev,
      hours: hours.toString(),
      minutes: minutes.toString(),
    } : null);
  }
}, [timeEntries]);
```

**Nagłówek tygodnia 2x większy (linia 300):**
```typescript
// BYŁO: text-lg
// BĘDZIE: text-2xl
<span className="font-semibold text-2xl">
  {format(currentWeekStart, 'd MMM', { locale: pl })} - {format(weekEnd, 'd MMM yyyy', { locale: pl })}
</span>
```

**Nagłówek dnia 2x większy (linia 362):**
```typescript
// BYŁO: text-lg
// BĘDZIE: text-2xl
<div className="text-2xl font-semibold text-center capitalize">{editingDayLabel}</div>
```

**Suma tygodnia/miesiąca - right aligned (linie 442-450):**
```typescript
<div className="space-y-1.5 pt-2 border-t">
  <div className="flex justify-end items-center gap-3">
    <span className="text-sm font-bold text-foreground">Suma tygodnia:</span>
    <span className="font-bold">{formatMinutes(weekTotal)}</span>
  </div>
  <div className="flex justify-end items-center gap-3">
    <span className="text-sm font-bold text-foreground">Suma miesiąca ({monthName}):</span>
    <span className="font-bold">{formatMinutes(monthTotal)}</span>
  </div>
</div>
```

---

### 2. WorkerTimeDialog.tsx - Zamykanie po START

**W handleStart (linia 69), po toast.success dodać zamknięcie dialogu:**
```typescript
const handleStart = async () => {
  setOptimisticWorking(true);
  setIsLoading(true);
  
  try {
    const now = new Date();
    await createTimeEntry.mutateAsync({...});
    toast.success(`${employee.name} rozpoczął pracę`);
    refetchTimeEntries();
    onOpenChange(false); // NOWE: Zamknij dialog po START
  } catch (error) {
    ...
  } finally {
    setIsLoading(false);
    setTimeout(() => setOptimisticWorking(null), 500);
  }
};
```

**Mobile fullscreen (linia 155):**
```typescript
// BYŁO:
<DialogContent className={`... ${isMobile ? "h-[100dvh] max-h-[100dvh] rounded-none" : "max-h-[90vh]"} ...`}>

// Jest już poprawnie! Sprawdzić tylko czy działa.
```

---

### 3. EmployeesList.tsx - Większe fonty + pierwszy slot dnia

**Fonty 2x większe (linie 141-149, 162):**
```typescript
// Imię pracownika (linia 147):
// BYŁO: text-base max-w-[140px]
// BĘDZIE: text-2xl max-w-[160px]
<span className={`font-medium text-center truncate ${centered ? 'text-2xl max-w-[160px]' : 'text-sm max-w-[120px]'}`}>
  {employee.name}
</span>

// "W pracy od" label (linia 162):
// BYŁO: text-xs
// BĘDZIE: text-lg
<span className="text-lg text-primary mt-1">
  W pracy od {workingFrom}
</span>
```

**Pierwszy slot dnia (linie 62-72):**
```typescript
// BYŁO:
const getWorkingFromTime = (employeeId: string) => {
  const activeEntry = timeEntries.find(
    (e) => e.employee_id === employeeId && !e.end_time
  );
  if (!activeEntry?.start_time) return null;
  ...
};

// BĘDZIE:
const getWorkingFromTime = (employeeId: string) => {
  // Znajdź pierwszy aktywny slot dnia (sortuj po start_time)
  const activeEntries = timeEntries
    .filter((e) => e.employee_id === employeeId && !e.end_time)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  
  const firstEntry = activeEntries[0];
  if (!firstEntry?.start_time) return null;
  
  try {
    return format(new Date(firstEntry.start_time), 'HH:mm');
  } catch {
    return null;
  }
};
```

---

### 4. HallView.tsx - Naprawa mapowania usług

**reservationsWithServices (linie 762-784):**
```typescript
// BYŁO (używa service_items jako primary, ale nie sprawdza service_ids):
const reservationsWithServices = useMemo(() => {
  return reservations.map(reservation => {
    const serviceItems = reservation.service_items as any[] | undefined;
    if (serviceItems && serviceItems.length > 0) {
      return { ...reservation, services_data: serviceItems.map(item => ({...})) };
    }
    return { ...reservation, services_data: reservation.service_ids?.map(...) || [] };
  });
}, [reservations, servicesMap]);

// BĘDZIE (service_ids jako kanoniczne źródło):
const reservationsWithServices = useMemo(() => {
  return reservations.map(reservation => {
    const serviceItems = reservation.service_items as any[] | undefined;
    const serviceIds = reservation.service_ids;
    
    let services_data: Array<{ id: string; name: string }> = [];
    
    // service_ids to kanoniczne źródło (jak w AdminDashboard)
    if (serviceIds && serviceIds.length > 0) {
      const itemsById = new Map<string, any>();
      (serviceItems || []).forEach(item => {
        const id = item.id || item.service_id;
        if (id) itemsById.set(id, item);
      });
      
      services_data = serviceIds.map(id => {
        const item = itemsById.get(id);
        const globalName = servicesMap.get(id);
        return {
          id,
          name: item?.name ?? globalName ?? 'Usługa',
        };
      });
    } else if (serviceItems && serviceItems.length > 0) {
      // Fallback z deduplicacją
      const seen = new Set<string>();
      services_data = serviceItems
        .filter(item => {
          const id = item.id || item.service_id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map(item => ({
          id: item.id || item.service_id,
          name: item.name || servicesMap.get(item.id || item.service_id) || 'Usługa',
        }));
    }
    
    return { ...reservation, services_data };
  });
}, [reservations, servicesMap]);
```

**selectedReservationWithServices (linie 788-811):**
Zastosować tę samą logikę co powyżej.

---

### 5. EmployeesView.tsx - Zamiana kart na tabelkę

**Importy (dodać):**
```typescript
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
```

**Nowa struktura głównego widoku (linie 390-485):**
```typescript
<>
  {/* Tabelka pracowników */}
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Pracownik</TableHead>
        <TableHead>Czas</TableHead>
        <TableHead className="text-right">Kwota</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {activeEmployees.map((employee) => {
        const summary = periodSummary.get(employee.id);
        const totalMinutes = summary?.total_minutes || 0;
        const preOpeningMinutes = preOpeningByEmployee.get(employee.id) || 0;
        const displayMinutes = timeCalculationMode === 'opening_to_stop'
          ? Math.max(0, totalMinutes - preOpeningMinutes)
          : totalMinutes;
        const displayHours = formatMinutesToTime(displayMinutes);
        const earnings = employee.hourly_rate 
          ? ((displayMinutes / 60) * employee.hourly_rate).toFixed(2)
          : null;
        
        return (
          <TableRow 
            key={employee.id} 
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => handleTileClick(employee)}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {employee.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{employee.name}</span>
                {isAdmin && (
                  <button
                    onClick={(e) => handleEditEmployee(e, employee)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </TableCell>
            <TableCell>{displayHours}</TableCell>
            <TableCell className="text-right font-medium">
              {earnings ? `${earnings} zł` : '-'}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
    {isAdmin && totalEarnings > 0 && (
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}></TableCell>
          <TableCell className="text-right font-bold">
            Suma wypłat {isWeeklyMode ? 'tygodnia' : format(currentDate, 'LLLL', { locale: pl })}: {totalEarnings.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
          </TableCell>
        </TableRow>
      </TableFooter>
    )}
  </Table>

  {/* Sekcja nieobecności */}
  {(() => {
    // Zbierz wszystkich pracowników z urlopami w tym okresie
    const employeesWithDaysOff = activeEmployees
      .map(emp => ({
        employee: emp,
        daysOff: formatDaysOffForPeriodFlat(getDaysOffForEmployee(emp.id)),
      }))
      .filter(item => item.daysOff.length > 0);

    if (employeesWithDaysOff.length === 0) return null;

    return (
      <div className="mt-6 space-y-3">
        <h3 className="font-medium text-muted-foreground">Nieobecności</h3>
        <div className="space-y-2">
          {employeesWithDaysOff.map(({ employee, daysOff }) => (
            <div key={employee.id} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
              <Avatar className="h-8 w-8">
                <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {employee.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{employee.name}</div>
                <div className="text-sm text-muted-foreground">{daysOff}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  })()}
</>
```

**Nowa funkcja formatDaysOffForPeriodFlat (dodać przed return):**
```typescript
// Formatuje daty urlopów jako jeden string z range'ami
const formatDaysOffForPeriodFlat = (employeeDaysOff: EmployeeDayOff[]): string => {
  const allDates: Date[] = [];
  
  employeeDaysOff.forEach(item => {
    const from = parseISO(item.date_from);
    const to = parseISO(item.date_to);
    const daysInRange = eachDayOfInterval({ start: from, end: to });
    daysInRange.forEach(day => {
      const isInPeriod = isWeeklyMode 
        ? isSameWeek(day, currentDate, { weekStartsOn: 1 })
        : isSameMonth(day, currentDate);
      if (isInPeriod) {
        allDates.push(day);
      }
    });
  });

  if (allDates.length === 0) return '';

  // Sort and deduplicate
  allDates.sort((a, b) => a.getTime() - b.getTime());
  const uniqueDates = allDates.filter((d, i, arr) => 
    i === 0 || d.getTime() !== arr[i-1].getTime()
  );

  // Group consecutive dates into ranges
  const parts: string[] = [];
  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;

  uniqueDates.forEach((date, idx) => {
    const prevDate = uniqueDates[idx - 1];
    const isConsecutive = prevDate && 
      (date.getTime() - prevDate.getTime()) === 24 * 60 * 60 * 1000;

    if (isConsecutive && rangeStart) {
      rangeEnd = date;
    } else {
      if (rangeStart) {
        if (rangeEnd) {
          parts.push(`${format(rangeStart, 'd')} - ${format(rangeEnd, 'd.MM')}`);
        } else {
          parts.push(format(rangeStart, 'd.MM'));
        }
      }
      rangeStart = date;
      rangeEnd = null;
    }
  });

  // Close last range
  if (rangeStart) {
    if (rangeEnd) {
      parts.push(`${format(rangeStart, 'd')} - ${format(rangeEnd, 'd.MM')}`);
    } else {
      parts.push(format(rangeStart, 'd.MM'));
    }
  }

  return parts.join(', ');
};
```

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `WeeklySchedule.tsx` | Domyślnie zaznaczony dzisiaj, 2x większe nagłówki, suma right aligned |
| `WorkerTimeDialog.tsx` | Zamknięcie dialogu po START |
| `EmployeesList.tsx` | 2x większe fonty, pierwszy slot dnia |
| `HallView.tsx` | Naprawa mapowania usług (service_ids jako źródło) |
| `EmployeesView.tsx` | Zamiana kart na tabelkę + sekcja nieobecności |

---

## Testowanie

Po implementacji zweryfikuję każdy punkt:
1. Grafik otwiera się z zaznaczonym dzisiejszym dniem
2. Dialog zamyka się po kliknięciu START na widoku hali
3. Fonty "W pracy od" i imion są 2x większe na widoku hali
4. "W pracy od" pokazuje pierwszy slot dnia, nie ostatni
5. Karty rezerwacji na hali nie pokazują fallbacku "Usługa" dla usług które istnieją
6. Widok admina pracowników to tabelka z kolumnami Avatar+Imię, Czas, Kwota
7. Footer tabelki pokazuje sumę wypłat z nazwą okresu
8. Pod tabelką jest sekcja nieobecności z grupowaniem dat w range'e
