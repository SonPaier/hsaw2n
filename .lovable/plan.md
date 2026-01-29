
# Plan naprawy routingu

## Problem
Route `/hall/:hallId` w `InstanceAdminRoutes` przechwytuje ścieżkę `/halls` zanim ta dotrze do `/:view`. React Router traktuje `/halls` jako `/hall/:hallId` gdzie `hallId = "s"`.

## Rozwiązanie

### 1. Zmiana nazwy route dla pojedynczej hali
Zmienić `/hall/:hallId` na `/halls/:hallId` aby uniknąć kolizji:

**Przed:**
```
/hall/:hallId  ← przechwytuje /halls!
/:view
```

**Po:**
```
/halls/:hallId  ← teraz /halls NIE pasuje (brak :hallId)
/:view          ← /halls dopasuje się tutaj poprawnie
```

### 2. Zmiany w plikach

#### `src/App.tsx` - InstanceAdminRoutes
- Linia 139: zmienić `/hall/:hallId` → `/halls/:hallId`

#### `src/App.tsx` - DevRoutes  
- Już poprawne: używa `/admin/hall/:hallId` i `/admin/halls/:hallId`

#### Linki w aplikacji (jeśli istnieją)
- Sprawdzić czy jakieś komponenty linkują do `/hall/:hallId` i zaktualizować

## Szczegóły techniczne

### Kolejność routes w InstanceAdminRoutes (po zmianach):
```
/login            → InstanceAuth
/dashboard        → RoleBasedRedirect
/                 → RoleBasedRedirect
/admin            → AdminDashboard
/halls/:hallId    → HallView (specyficzny route)
/:view            → AdminDashboard (catch-all dla widoków)
```

### Dlaczego to zadziała:
1. `/halls` nie pasuje do `/halls/:hallId` (brak segmentu po `/halls/`)
2. `/halls` dopasuje się do `/:view` gdzie `view = "halls"`
3. `/halls/abc123` dopasuje się do `/halls/:hallId` gdzie `hallId = "abc123"`

### Weryfikacja po zmianach:
- Niezalogowany → `/login`
- Zalogowany z rolą `hall` → `/halls` (lista hal)
- Zalogowany z rolą `admin` → `/admin` (kalendarz)
- Kliknięcie na halę → `/halls/:hallId` (widok hali)
