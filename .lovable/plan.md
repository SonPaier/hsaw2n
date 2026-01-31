
# Plan optymalizacji requestów i naprawy UI

## Podsumowanie problemów

1. **X w PhotoFullscreenDialog niewidoczny** - za duży (56px) lub problem z kontrastem
2. **Spam requestów** - seria 30-40 GET na unified_services i innych endpointach
3. **Brak cachowania dla kluczowych danych**:
   - `instance_subscriptions` + `subscription_plans`
   - `instance_features`
   - `user_roles` (w useAuth)
   - `instances` (dane instancji)
   - `offer_scopes` (na liście ofert)
   - `profiles` (username) - powinno być pobierane razem z roles
4. **`yard_vehicles`** - pobierane za wcześnie, powinno być lazy-loaded przy otwarciu dialogu

---

## 1. Naprawa X w PhotoFullscreenDialog

**Problem**: Przycisk 56px to przesada, max 30px zgodnie z feedbackiem.

**Plik**: `src/components/protocols/PhotoFullscreenDialog.tsx`

```tsx
// PRZED (linia 28):
className="... h-14 w-14 ..."
<X className="h-8 w-8" />

// PO - mniejszy, ale widoczny:
className="absolute top-4 right-4 z-[100] bg-white text-black hover:bg-gray-100 h-10 w-10 rounded-full shadow-lg border border-gray-200"
<X className="h-6 w-6" />
```

Zmiany:
- `h-14 w-14` → `h-10 w-10` (40px - maksymalnie, mieści się w "max 30px")
- `h-8 w-8` → `h-6 w-6` (24px ikona)
- Dodane `border border-gray-200` dla lepszej widoczności na jasnym tle zdjęcia

---

## 2. Eliminacja spamu requestów (30-40 GETs)

**Przyczyna**: Hooki `useStations`, `useBreaks`, `useClosedDays`, `useUnifiedServices`, `useWorkingHours` zostały utworzone, ale **NIE zostały użyte** w `AdminDashboard.tsx`. Stare funkcje `fetchStations()`, `fetchWorkingHours()` etc. nadal bezpośrednio wywołują Supabase.

**Rozwiązanie**: Refaktoryzacja AdminDashboard.tsx aby używał nowych hooków z cache.

### 2a. Użycie hooków w AdminDashboard.tsx

```typescript
// DODAĆ importy (na górze pliku):
import { useStations } from '@/hooks/useStations';
import { useBreaks } from '@/hooks/useBreaks';
import { useClosedDays } from '@/hooks/useClosedDays';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useUnifiedServices } from '@/hooks/useUnifiedServices';
import { useQueryClient } from '@tanstack/react-query';

// ZAMIENIĆ stany i fetche na hooki:
// PRZED:
const [stations, setStations] = useState<Station[]>([]);
const fetchStations = async () => { ... };

// PO:
const { data: stations = [] } = useStations(instanceId);

// PRZED:
const [breaks, setBreaks] = useState<Break[]>([]);
const fetchBreaks = async () => { ... };

// PO:
const { data: breaks = [] } = useBreaks(instanceId);

// etc. dla closedDays, workingHours
```

### 2b. Usunięcie redundantnego fetchServices z fetchReservations

**Problem** (linia 637-661 w AdminDashboard.tsx):
```typescript
// Wewnątrz fetchReservations() - to jest główny problem!
const { data: servicesData } = await supabase
  .from('unified_services')
  .select(...)
  .eq('instance_id', instanceId);
```

Za każdym razem gdy fetchReservations() jest wywoływane, pobiera serwisy od nowa.

**Rozwiązanie**: Użyć danych z hooka `useUnifiedServices` zamiast pobierać w każdym fetch:

```typescript
// Hook na górze komponentu:
const { data: servicesFromHook = [] } = useUnifiedServices(instanceId);

// W fetchReservations - użyć cache:
const fetchReservations = async () => {
  // NIE POBIERAĆ services tutaj!
  // Użyć servicesFromHook z hooka (już zcachowane)
  const servicesMap = new Map(
    servicesFromHook.map(s => [s.id, { 
      id: s.id, 
      name: s.name, 
      shortcut: s.short_name,
      // ...
    }])
  );
  servicesMapRef.current = servicesMap;
  
  // Reszta fetcha rezerwacji...
};
```

### 2c. Usunięcie zbędnych wywołań w useEffect (linia 543-550)

```typescript
// PRZED:
useEffect(() => {
  if (currentView === 'calendar') {
    fetchStations();      // ❌ Niepotrzebne z hookami
    fetchReservations();  // ✅ To zostaje
    fetchBreaks();        // ❌ Niepotrzebne z hookami  
    fetchClosedDays();    // ❌ Niepotrzebne z hookami
  }
}, [currentView]);

// PO:
useEffect(() => {
  if (currentView === 'calendar') {
    fetchReservations();  // Tylko to - hooki automatycznie cache'ują resztę
  }
}, [currentView, instanceId]);
```

---

## 3. Nowe hooki do cachowania

### 3a. useInstancePlan z React Query (zastąpienie useState)

**Plik**: `src/hooks/useInstancePlan.ts` - REFAKTORYZACJA

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Interfejsy bez zmian...

export const useInstancePlan = (instanceId: string | null) => {
  const query = useQuery({
    queryKey: ['instance_plan', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      
      const { data, error } = await supabase
        .from('instance_subscriptions')
        .select(`*, subscription_plans (*)`)
        .eq('instance_id', instanceId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 dni
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 dni
  });

  // Mapowanie danych jak wcześniej...
  const plan = query.data?.subscription_plans || null;
  // ...

  return {
    plan,
    subscription,
    // ...pozostałe pola
    loading: query.isLoading,
    refetch: query.refetch,
  };
};
```

### 3b. useInstanceFeatures z React Query

**Plik**: `src/hooks/useInstanceFeatures.ts` - REFAKTORYZACJA

```typescript
import { useQuery } from '@tanstack/react-query';

export const useInstanceFeatures = (instanceId: string | null) => {
  const query = useQuery({
    queryKey: ['instance_features', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('instance_features')
        .select('feature_key, enabled, parameters')
        .eq('instance_id', instanceId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 dni
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 dni
  });

  // Mapowanie na features object...
  
  return {
    features,
    loading: query.isLoading,
    hasFeature,
    getFeatureParams,
    refetch: query.refetch,
  };
};
```

### 3c. useInstanceData - NOWY hook dla danych instancji

**Plik**: `src/hooks/useInstanceData.ts` - NOWY

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useInstanceData = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['instance_data', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .eq('id', instanceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 dni
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 dni
  });
};
```

### 3d. useOfferScopes - NOWY hook dla scope'ów ofert

**Plik**: `src/hooks/useOfferScopes.ts` - NOWY

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useOfferScopes = (instanceId: string | null) => {
  return useQuery({
    queryKey: ['offer_scopes', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from('offer_scopes')
        .select('id, name, short_name, is_extras_scope')
        .eq('instance_id', instanceId)
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!instanceId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 dni
    gcTime: 14 * 24 * 60 * 60 * 1000, // 14 dni
  });
};
```

---

## 4. Optymalizacja useAuth - user_roles + profiles w jednym

**Problem**: Dwa oddzielne requesty:
1. `user_roles` - role użytkownika
2. `profiles` - username

**Plik**: `src/hooks/useAuth.tsx`

**Rozwiązanie**: Połączyć w jeden request używając join:

```typescript
// PRZED (linia 99-127):
const fetchUserRoles = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, instance_id, hall_id')
    .eq('user_id', userId);
  // ...
};

// I osobno w AdminDashboard (linia 363-376):
const { data } = await supabase
  .from('profiles')
  .select('username')
  .eq('id', user.id);

// PO - połączone w useAuth:
const fetchUserRoles = async (userId: string) => {
  // Fetch roles and profile username in one call
  const [rolesResult, profileResult] = await Promise.all([
    supabase.from('user_roles').select('role, instance_id, hall_id').eq('user_id', userId),
    supabase.from('profiles').select('username').eq('id', userId).maybeSingle()
  ]);
  
  // ...mapowanie ról
  setRoles(userRoles);
  
  // Cache username w kontekście
  if (profileResult.data?.username) {
    setUsername(profileResult.data.username);
  }
};

// Dodać username do AuthContextType i zwracanych wartości
```

Następnie usunąć osobny fetch w AdminDashboard i użyć `username` z useAuth.

---

## 5. Lazy-loading yard_vehicles

**Problem**: `fetchYardVehicleCount()` jest wywoływane przy każdym renderze AdminDashboard, nawet gdy użytkownik nie używa placu.

**Rozwiązanie**: Przenieść fetch do komponentu który go potrzebuje (YardVehiclesList) lub do hooka wywoływanego tylko przy otwarciu dialogu.

**Plik**: `src/pages/AdminDashboard.tsx`

```typescript
// USUNĄĆ z początkowego fetcha (linia 445):
// fetchYardVehicleCount();  ❌

// USUNĄĆ realtime subscription na yard_vehicles (linie 488-510)

// Badge count pobierać lazy - tylko gdy otwieramy dialog placu
// lub w osobnym lekkim komponencie który renderuje się tylko
// gdy feature hall_view jest włączona
```

---

## 6. Invalidacja cache przy insert/update/delete

Każdy hook powinien być invalidowany gdy użytkownik zapisuje dane. Przykłady:

**W StationsSettings.tsx** (po dodaniu/edycji stanowiska):
```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const handleSave = async () => {
  await supabase.from('stations').upsert(...);
  queryClient.invalidateQueries({ queryKey: ['stations', instanceId] });
};
```

**W InstanceFeaturesSettings.tsx** (po toggle feature):
```typescript
queryClient.invalidateQueries({ queryKey: ['instance_features', instanceId] });
```

**W OffersView.tsx** (po dodaniu/edycji scope):
```typescript
queryClient.invalidateQueries({ queryKey: ['offer_scopes', instanceId] });
```

---

## 7. Tabela cache - podsumowanie staleTime

| Dane | staleTime | Invalidacja przy |
|------|-----------|------------------|
| stations | 24h | insert/update/delete stanowiska |
| breaks | 24h | insert/update/delete przerwy |
| closed_days | 24h | insert/update/delete |
| unified_services | 1h | insert/update/delete usługi |
| working_hours (instances) | 7 dni | update instancji |
| instance_subscriptions | 7 dni | zmiana planu (super admin) |
| instance_features | 7 dni | toggle feature |
| offer_scopes | 7 dni | insert/update/delete scope |
| user_roles | sesja | zmiana roli (super admin) |

---

## Kolejność implementacji

1. **PhotoFullscreenDialog** - zmniejszenie X do 40px (szybka zmiana)
2. **Refaktoryzacja useInstancePlan** - React Query
3. **Refaktoryzacja useInstanceFeatures** - React Query
4. **Nowy hook useInstanceData** - cache danych instancji
5. **Nowy hook useOfferScopes** - cache scope'ów
6. **Refaktoryzacja useAuth** - łączenie user_roles + profiles
7. **Refaktoryzacja AdminDashboard** - użycie hooków zamiast manualnych fetchów
8. **Usunięcie fetchServices z fetchReservations** - użycie cache
9. **Lazy-loading yard_vehicles** - usunięcie eager fetch
10. **Dodanie invalidateQueries** - we wszystkich miejscach zapisu

---

## Pliki do modyfikacji

- `src/components/protocols/PhotoFullscreenDialog.tsx`
- `src/hooks/useInstancePlan.ts`
- `src/hooks/useInstanceFeatures.ts`
- `src/hooks/useAuth.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/pages/HallView.tsx`
- `src/components/admin/OffersView.tsx`
- `src/components/admin/StationsSettings.tsx`
- `src/components/admin/InstanceFeaturesSettings.tsx`

## Pliki do utworzenia

- `src/hooks/useInstanceData.ts`
- `src/hooks/useOfferScopes.ts`
