
# Plan implementacji - poprawki UI i optymalizacja cachowania

## ✅ WSZYSTKIE ZADANIA ZAKOŃCZONE

1. ✅ **X w PhotoFullscreenDialog** - biały okrąg z wyraźnym X (32px icon, 56px button)
2. ✅ **Klikalne usługi w HallReservationCard** - toggle checkmark z zapisem do `checked_service_ids`
3. ✅ **Optymalizacja cachowania** - React Query hooks (useStations, useBreaks, useClosedDays, useUnifiedServices, useWorkingHours)
4. ✅ **Filtr dat rezerwacji** - zmiana z subMonths(2) na subWeeks(1) od poniedziałku

---

## 1. Naprawa X w PhotoFullscreenDialog

**Problem**: Przycisk X nie jest widoczny. Obecny kod ma `z-[100]` ale DialogContent ma domyślnie `z-50`. Problem jest w tym że Button jest wewnątrz DialogContent który ma overflow hidden i dark background.

**Plik**: `src/components/protocols/PhotoFullscreenDialog.tsx`

**Zmiana**:
```tsx
// PRZED (linia 25-35):
<Button
  variant="ghost"
  size="icon"
  className="absolute top-4 right-4 z-[100] bg-black/50 text-white hover:bg-white/30 h-10 w-10"
  onClick={...}
>
  <X className="h-7 w-7" />
</Button>

// PO - biały okrąg z wyraźnym X:
<Button
  variant="ghost"
  size="icon"
  className="absolute top-4 right-4 z-[100] bg-white text-black hover:bg-white/80 h-14 w-14 rounded-full shadow-lg"
  onClick={...}
>
  <X className="h-8 w-8" />
</Button>
```

Zmiany:
- `bg-black/50` → `bg-white` (biały okrąg)
- `text-white` → `text-black` (czarny X na białym tle)
- `h-10 w-10` → `h-14 w-14` (większy przycisk - 56px)
- `h-7 w-7` → `h-8 w-8` (większa ikona - 32px)
- Dodany `rounded-full shadow-lg` (okrągły z cieniem)

---

## 2. Klikalne usługi w HallReservationCard (toggle checkmark)

**Pliki do zmian**:

| Plik | Zmiana |
|------|--------|
| `src/components/admin/halls/HallReservationCard.tsx` | Dodanie props i toggle usług |
| `src/pages/HallView.tsx` | Przekazanie checked_service_ids i handler |

### 2a. HallReservationCard.tsx

**Zmiany w interfejsie (linia 10-33)**:
```tsx
interface HallReservationCardProps {
  reservation: {
    id: string;
    // ... existing
    services_data?: Array<{ id?: string; name: string }>; // Dodać id
    checked_service_ids?: string[] | null; // NOWE
  };
  // ... existing props
  onServiceToggle?: (serviceId: string, checked: boolean) => Promise<void>; // NOWE
}
```

**Zmiana renderowania usług (linie 208-217)**:
```tsx
{/* Services list - klikalne z checkmark */}
{services_data && services_data.length > 0 && (
  <div className="space-y-1">
    {services_data.map((service, idx) => {
      const isChecked = service.id && checked_service_ids?.includes(service.id);
      const canToggle = !!service.id && !!onServiceToggle;
      
      return (
        <div 
          key={service.id || idx} 
          className={cn(
            "text-2xl font-bold flex items-center gap-2",
            canToggle && "cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 py-1",
            isChecked && "text-muted-foreground"
          )}
          onClick={canToggle ? () => onServiceToggle(service.id!, !isChecked) : undefined}
        >
          <span className={isChecked ? "line-through" : ""}>
            {idx + 1}. {service.name}
          </span>
          {isChecked && <Check className="w-6 h-6 text-green-600" />}
        </div>
      );
    })}
  </div>
)}
```

### 2b. HallView.tsx

**Dodanie do interfejsu Reservation (linia 26-53)**:
```tsx
interface Reservation {
  // ... existing
  checked_service_ids?: string[] | null; // DODAĆ
}
```

**Dodanie checked_service_ids do wszystkich selectów** (linie 463-486, 610-631, 655-677, 783-803):
- Dodać `checked_service_ids` do każdego `.select()`

**Zmiana mapowania services_data (linie 760-767)**:
```tsx
const reservationsWithServices = useMemo(() => {
  return reservations.map(reservation => ({
    ...reservation,
    services_data: reservation.service_ids?.map(id => ({
      id,  // Dodać id!
      name: servicesMap.get(id) || id,
    })) || [],
  }));
}, [reservations, servicesMap]);
```

**Dodanie handlera toggle (po linii 757)**:
```tsx
const handleServiceToggle = async (serviceId: string, checked: boolean) => {
  if (!selectedReservation) return;
  
  const currentChecked = selectedReservation.checked_service_ids || [];
  const newChecked = checked 
    ? [...currentChecked, serviceId]
    : currentChecked.filter(id => id !== serviceId);
  
  const { error } = await supabase
    .from('reservations')
    .update({ checked_service_ids: newChecked })
    .eq('id', selectedReservation.id);
  
  if (error) {
    toast.error('Błąd podczas zapisywania');
    return;
  }
  
  // Update local state
  setReservations(prev => prev.map(r => 
    r.id === selectedReservation.id ? { ...r, checked_service_ids: newChecked } : r
  ));
  setSelectedReservation(prev => 
    prev ? { ...prev, checked_service_ids: newChecked } : prev
  );
};
```

**Przekazanie do HallReservationCard (linia 966-981)**:
```tsx
<HallReservationCard
  reservation={{
    ...selectedReservationWithServices,
    checked_service_ids: selectedReservation.checked_service_ids,
  }}
  // ... existing props
  onServiceToggle={handleServiceToggle}
/>
```

---

## 3. Optymalizacja cachowania - React Query hooks

**Strategia staleTime**:

| Dane | staleTime | gcTime |
|------|-----------|--------|
| stations | 24h | 48h |
| breaks | 24h | 48h |
| closed_days | 24h | 48h |
| unified_services | 1h | 2h |
| instances (working_hours) | 7 dni | 14 dni |

### 3a. Nowe hooki

**Plik**: `src/hooks/useStations.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useStations = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['stations', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data } = await supabase
        .from('stations')
        .select('id, name, type')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 48 * 60 * 60 * 1000, // 48h
  });
};
```

**Plik**: `src/hooks/useBreaks.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useBreaks = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['breaks', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data } = await supabase
        .from('breaks')
        .select('*')
        .eq('instance_id', instanceId);
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 48 * 60 * 60 * 1000, // 48h
  });
};
```

**Plik**: `src/hooks/useClosedDays.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useClosedDays = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['closed_days', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data } = await supabase
        .from('closed_days')
        .select('*')
        .eq('instance_id', instanceId);
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 48 * 60 * 60 * 1000, // 48h
  });
};
```

**Plik**: `src/hooks/useUnifiedServices.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUnifiedServices = (instanceId: string | null, serviceType?: 'reservation' | 'both') => {
  return useQuery({
    queryKey: ['unified_services', instanceId, serviceType],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data } = await supabase
        .from('unified_services')
        .select('id, name, short_name, price_small, price_medium, price_large, price_from')
        .eq('instance_id', instanceId)
        .in('service_type', ['reservation', 'both']);
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 2 * 60 * 60 * 1000, // 2h
  });
};
```

**Plik**: `src/hooks/useWorkingHours.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useWorkingHours = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['working_hours', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const { data } = await supabase
        .from('instances')
        .select('working_hours')
        .eq('id', instanceId)
        .maybeSingle();
      return data?.working_hours as Record<string, { open: string; close: string } | null> || null;
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 dni
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 dni
  });
};
```

### 3b. Czy cache jest odświeżany przy insert/update?

**Odpowiedź**: NIE automatycznie. React Query nie wie o zmianach w bazie danych.

**Rozwiązanie**: Przy zapisie (insert/update) wywołać `queryClient.invalidateQueries()`:

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Po dodaniu/edycji przerwy:
queryClient.invalidateQueries({ queryKey: ['breaks', instanceId] });

// Po dodaniu/edycji stanowiska:
queryClient.invalidateQueries({ queryKey: ['stations', instanceId] });
```

To wymusi refetch przy następnym użyciu hooka.

---

## 4. Naprawa filtra dat rezerwacji

**Problem**: `loadedDateRange.from` jest inicjalizowane jako `subMonths(new Date(), 2)` co ładuje rezerwacje od 2 miesięcy wstecz.

**Plik**: `src/pages/AdminDashboard.tsx` (linia 174-177)

**Zmiana**:
```typescript
import { subWeeks, startOfWeek } from 'date-fns';

// PRZED:
const [loadedDateRange, setLoadedDateRange] = useState<{ from: Date; to: null }>({
  from: subMonths(new Date(), 2),
  to: null
});

// PO - tydzień wstecz od poniedziałku:
const [loadedDateRange, setLoadedDateRange] = useState<{ from: Date; to: null }>(() => {
  const today = new Date();
  const mondayThisWeek = startOfWeek(today, { weekStartsOn: 1 });
  return {
    from: subWeeks(mondayThisWeek, 1), // poniedziałek tydzień wcześniej
    to: null
  };
});
```

To da filtr `reservation_date=gte.2026-01-20` (poniedziałek tydzień wcześniej) zamiast `2025-11-30`.

---

## Kolejność implementacji

1. **PhotoFullscreenDialog** - naprawa X (szybka zmiana)
2. **Klikalne usługi** - HallReservationCard + HallView
3. **Filtr dat** - subWeeks zamiast subMonths
4. **Cache hooks** - nowe pliki
5. **Refactor AdminDashboard/HallView** - użycie nowych hooks + invalidateQueries w miejscach zapisu

---

## Pliki do utworzenia

- `src/hooks/useStations.ts`
- `src/hooks/useBreaks.ts`
- `src/hooks/useClosedDays.ts`
- `src/hooks/useUnifiedServices.ts`
- `src/hooks/useWorkingHours.ts`

## Pliki do modyfikacji

- `src/components/protocols/PhotoFullscreenDialog.tsx`
- `src/components/admin/halls/HallReservationCard.tsx`
- `src/pages/HallView.tsx`
- `src/pages/AdminDashboard.tsx`
