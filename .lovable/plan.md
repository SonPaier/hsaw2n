
# Plan: Udostępnienie modułu "Protokoły" dla pracowników

## Cel
Umożliwić użytkownikom z rolą `employee` dostęp do modułu "Protokoły" (protokoły przyjęcia/wydania pojazdu).

## Zakres zmian

### 1. Sidebar w AdminDashboard.tsx
**Plik:** `src/pages/AdminDashboard.tsx`

Zmiana warunku wyświetlania przycisku "Protokoły" w sidebarze:
- **Przed:** `hasFeature('vehicle_reception_protocol') && userRole !== 'employee'`
- **Po:** `hasFeature('vehicle_reception_protocol')` (bez ograniczenia dla pracowników)

**Lokalizacja:** Linia ~2309

### 2. Mobile Bottom Navigation
**Plik:** `src/components/admin/MobileBottomNav.tsx`

Zmiana warunku w tablicy `moreMenuItems`:
- **Przed:** `protocolsEnabled && userRole !== 'employee'`
- **Po:** `protocolsEnabled` (bez ograniczenia dla pracowników)

**Lokalizacja:** Linia ~74

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `AdminDashboard.tsx` | Usunięcie `userRole !== 'employee'` z warunku dla protocols |
| `MobileBottomNav.tsx` | Usunięcie `userRole !== 'employee'` z warunku dla protocols |

## Uwagi
- ProtocolsView nie wymaga zmian - przyjmuje `instanceId` jako props z AdminDashboard
- Uprawnienia do funkcji (ustawienia, usuwanie) mogą zostać dodatkowo ograniczone w przyszłości jeśli potrzeba
