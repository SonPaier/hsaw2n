

# Ustawienia pracowników - zaktualizowany plan

## Co zrobimy

### 1. Wpis do bazy danych
Utworzenie rekordu w tabeli `workers_settings` dla instancji armcar:

```sql
INSERT INTO workers_settings (instance_id, overtime_enabled, start_stop_enabled, standard_hours_per_day, report_frequency)
VALUES ('4ce15650-76c7-47e7-b5c8-32b9a2d1c321', false, true, 8, 'month');
```

### 2. Drawer ustawień pracowników
Nowy komponent `WorkersSettingsDrawer.tsx`:

**Struktura UI:**
- Sticky header: "Ustawienia czasu pracy" + przycisk X
- Scrollowalna zawartość
- Sticky biały footer: "Anuluj" i "Zapisz"

**Pola formularza:**
| Pole | Typ | Opis |
|------|-----|------|
| Rejestracja Start/Stop | Switch | "Włączona rejestracja Start/Stop" |
| Nadgodziny | Switch | "Naliczanie nadgodzin" |
| Norma dzienna | Input (liczba) | Widoczne TYLKO gdy nadgodziny włączone |
| Okres rozliczeniowy | RadioGroup | Miesięcznie (domyślne) / Tygodniowo |

**Usunięte:** Pole "Przerwy wliczane w czas pracy" - niepotrzebne, system i tak sumuje wszystkie sesje start/stop.

### 3. Przycisk zębatki w EmployeesView
Ikona `Settings2` w headerze obok innych przycisków - otwiera drawer (tylko dla admina).

### 4. Format czasu: "39h 32min"
Zmiana funkcji `formatMinutesToTime`:
```
Przed: 39:32
Po: 39h 32min
```

### 5. Suma wypłat pod kafelkami
```
Suma wypłat: 2 340,50 zł
```
Widoczne tylko dla admina, sumuje pracowników z podaną stawką.

### 6. Ołówek w prawym górnym rogu kafelka
- Pozycja: `absolute top-3 right-3`
- Rozmiar: `w-5 h-5` (większy niż obecny)

### 7. Usunięcie etykiety "JPG, PNG do 5MB"
Z dialogu dodawania/edycji pracownika.

---

## Szczegóły techniczne

### Nowy plik: `src/hooks/useWorkersSettings.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkersSettings {
  instance_id: string;
  start_stop_enabled: boolean;
  overtime_enabled: boolean;
  standard_hours_per_day: number;
  report_frequency: 'month' | 'week';
}

export const useWorkersSettings = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['workers-settings', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers_settings')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!instanceId,
  });
};

export const useUpdateWorkersSettings = (instanceId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<WorkersSettings>) => {
      const { error } = await supabase
        .from('workers_settings')
        .upsert({ instance_id: instanceId, ...settings });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers-settings', instanceId] });
    },
  });
};
```

### Nowy plik: `src/components/admin/employees/WorkersSettingsDrawer.tsx`

```tsx
<Sheet open={open} onOpenChange={onClose}>
  <SheetContent className="w-full sm:max-w-md p-0 flex flex-col" hideCloseButton>
    {/* Sticky header */}
    <div className="sticky top-0 z-10 bg-background border-b p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ustawienia czasu pracy</h2>
        <button onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>

    {/* Scrollable content */}
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Switch: Start/Stop */}
      <div className="flex items-center justify-between">
        <Label>Włączona rejestracja Start/Stop</Label>
        <Switch checked={startStopEnabled} onCheckedChange={setStartStopEnabled} />
      </div>

      {/* Switch: Nadgodziny */}
      <div className="flex items-center justify-between">
        <Label>Naliczanie nadgodzin</Label>
        <Switch checked={overtimeEnabled} onCheckedChange={setOvertimeEnabled} />
      </div>

      {/* Number: Norma dzienna - TYLKO gdy nadgodziny włączone */}
      {overtimeEnabled && (
        <div className="space-y-2">
          <Label>Norma dzienna (godziny)</Label>
          <Input type="number" min="1" max="24" value={standardHours} onChange={...} />
        </div>
      )}

      {/* RadioGroup: Okres rozliczeniowy */}
      <div className="space-y-3">
        <Label>Okres rozliczeniowy</Label>
        <RadioGroup value={reportFrequency} onValueChange={setReportFrequency}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="month" id="month" />
            <Label htmlFor="month" className="font-normal">Miesięcznie</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="week" id="week" />
            <Label htmlFor="week" className="font-normal">Tygodniowo</Label>
          </div>
        </RadioGroup>
      </div>
    </div>

    {/* Sticky white footer */}
    <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3">
      <Button variant="outline" onClick={onClose} className="flex-1">Anuluj</Button>
      <Button onClick={handleSave} disabled={saving} className="flex-1">
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Zapisz
      </Button>
    </div>
  </SheetContent>
</Sheet>
```

### Zmiany w `src/hooks/useTimeEntries.ts`

```typescript
// Linia 162-167: Zmiana formatu
export const formatMinutesToTime = (minutes: number | null): string => {
  if (!minutes) return '0h 0min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
};
```

### Zmiany w `src/components/admin/employees/EmployeesView.tsx`

**Nowe importy:**
```tsx
import { Settings2 } from 'lucide-react';
import WorkersSettingsDrawer from './WorkersSettingsDrawer';
```

**Nowy state:**
```tsx
const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
```

**Suma wypłat (useMemo):**
```tsx
const totalEarnings = useMemo(() => {
  return activeEmployees.reduce((sum, employee) => {
    const summary = monthlySummary.get(employee.id);
    if (summary && employee.hourly_rate) {
      return sum + (summary.total_minutes / 60) * employee.hourly_rate;
    }
    return sum;
  }, 0);
}, [activeEmployees, monthlySummary]);
```

**Header z zębatką:**
```tsx
{isAdmin && (
  <div className="flex gap-2">
    <Button onClick={() => setSettingsDrawerOpen(true)} variant="ghost" size="icon">
      <Settings2 className="w-5 h-5" />
    </Button>
    {/* ... pozostałe przyciski */}
  </div>
)}
```

**Kafelek pracownika - ołówek w rogu:**
```tsx
<CardContent className="p-4 relative">
  {isAdmin && (
    <button
      onClick={(e) => handleEditEmployee(e, employee)}
      className="absolute top-3 right-3 p-1.5 rounded hover:bg-muted"
    >
      <Pencil className="w-5 h-5 text-muted-foreground" />
    </button>
  )}
  <div className="flex items-start gap-3 pr-8">
    {/* Avatar i dane pracownika */}
  </div>
</CardContent>
```

**Suma wypłat pod kafelkami:**
```tsx
{isAdmin && totalEarnings > 0 && (
  <div className="pt-4 border-t mt-4">
    <div className="text-lg font-medium">
      Suma wypłat: {totalEarnings.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
    </div>
  </div>
)}
```

**Drawer na końcu:**
```tsx
<WorkersSettingsDrawer
  open={settingsDrawerOpen}
  onOpenChange={setSettingsDrawerOpen}
  instanceId={instanceId}
/>
```

### Zmiany w `src/components/admin/employees/AddEditEmployeeDialog.tsx`

**Usunięcie linii 207-209:**
```tsx
// Usunąć:
<p className="text-xs text-muted-foreground mt-1">
  JPG, PNG do 5MB
</p>
```

---

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| Baza danych | INSERT do `workers_settings` dla armcar |
| `useWorkersSettings.ts` | Nowy hook (fetch + update) |
| `WorkersSettingsDrawer.tsx` | Nowy drawer z ustawieniami |
| `useTimeEntries.ts` | Format "39h 32min" |
| `EmployeesView.tsx` | Zębatka, suma wypłat, ołówek w rogu |
| `AddEditEmployeeDialog.tsx` | Usunięcie etykiety formatu |

