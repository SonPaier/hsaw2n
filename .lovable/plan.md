
# Plan: Unit testy dla nawigacji (Sidebar/MobileBottomNav)

## Cel
Utworzenie kompleksowych testów jednostkowych dla komponentów nawigacyjnych panelu admina, pokrywających różne scenariusze widoczności menu items w zależności od:
- Typu widoku (mobile vs desktop)
- Feature flags z subskrypcji (offers, hall_view, vehicle_reception_protocol, followup)
- Roli użytkownika (admin vs employee)

## Analiza komponentów

### MobileBottomNav (src/components/admin/MobileBottomNav.tsx)
- Wyświetla dolną nawigację tylko na mobile (`lg:hidden`)
- Props sterujące widocznością menu items:
  - `offersEnabled` - pokazuje "Oferty"
  - `hallViewEnabled` - pokazuje "Hale" (tylko admin)
  - `protocolsEnabled` - pokazuje "Protokoły" (tylko admin)
  - `followupEnabled` - (obecnie nieużywane w UI)
  - `userRole` - 'admin' | 'employee'
- Sheet "Więcej" zawiera pełną listę menu items

### AdminDashboard sidebar (desktop)
- Sidebar widoczny tylko na desktop (`hidden lg:block`)
- Warunki widoczności:
  - "Oferty" - `hasFeature('offers')`
  - "Hale" - `hasFeature('hall_view') && userRole !== 'employee'`
  - "Protokoły" - `hasFeature('vehicle_reception_protocol') && userRole !== 'employee'`
  - "Ustawienia" - `userRole !== 'employee'`

## Plan testów

### Plik: `src/components/admin/MobileBottomNav.test.tsx`

#### Grupa A: Podstawowe renderowanie (NAV-U-001 do NAV-U-010)
| ID | Test Case |
|-----|-----------|
| NAV-U-001 | Renderuje 5 głównych przycisków nawigacji (Kalendarz, Rezerwacje, Plus, Powiadomienia, Więcej) |
| NAV-U-002 | Przycisk centralny (Plus) wywołuje `onAddReservation` |
| NAV-U-003 | Kliknięcie Kalendarz wywołuje `onViewChange('calendar')` |
| NAV-U-004 | Kliknięcie Rezerwacje wywołuje `onViewChange('reservations')` |
| NAV-U-005 | Kliknięcie Powiadomienia wywołuje `onViewChange('notifications')` |
| NAV-U-006 | Badge powiadomień wyświetla się gdy `unreadNotificationsCount > 0` |
| NAV-U-007 | Badge powiadomień jest ukryty gdy `unreadNotificationsCount === 0` |
| NAV-U-008 | Aktywny widok ma klasę `text-primary` |
| NAV-U-009 | Nieaktywny widok ma klasę `text-muted-foreground` |
| NAV-U-010 | Wyświetla wersję aplikacji w menu "Więcej" |

#### Grupa B: Sheet "Więcej" - podstawowa funkcjonalność (NAV-U-011 do NAV-U-020)
| ID | Test Case |
|-----|-----------|
| NAV-U-011 | Kliknięcie "Więcej" otwiera Sheet |
| NAV-U-012 | Sheet zawiera przycisk zamknięcia (X) |
| NAV-U-013 | Kliknięcie X zamyka Sheet |
| NAV-U-014 | Sheet zawiera przycisk wylogowania |
| NAV-U-015 | Przycisk wylogowania wywołuje `onLogout` |
| NAV-U-016 | Kliknięcie pozycji menu wywołuje `onViewChange` z odpowiednim typem |
| NAV-U-017 | Kliknięcie pozycji menu zamyka Sheet |
| NAV-U-018 | Badge przy powiadomieniach w Sheet wyświetla liczbę |
| NAV-U-019 | Aktywna pozycja menu ma wyróżnione tło (`bg-muted`) |
| NAV-U-020 | Zawsze widoczne: Kalendarz, Rezerwacje, Klienci, Powiadomienia |

#### Grupa C: Feature flags - widoczność menu items (NAV-U-021 do NAV-U-030)
| ID | Test Case |
|-----|-----------|
| NAV-U-021 | "Oferty" widoczne gdy `offersEnabled=true` |
| NAV-U-022 | "Oferty" ukryte gdy `offersEnabled=false` |
| NAV-U-023 | "Hale" widoczne gdy `hallViewEnabled=true` i `userRole='admin'` |
| NAV-U-024 | "Hale" ukryte gdy `hallViewEnabled=false` |
| NAV-U-025 | "Hale" ukryte gdy `hallViewEnabled=true` ale `userRole='employee'` |
| NAV-U-026 | "Protokoły" widoczne gdy `protocolsEnabled=true` i `userRole='admin'` |
| NAV-U-027 | "Protokoły" ukryte gdy `protocolsEnabled=false` |
| NAV-U-028 | "Protokoły" ukryte gdy `protocolsEnabled=true` ale `userRole='employee'` |
| NAV-U-029 | "Ustawienia" widoczne dla `userRole='admin'` |
| NAV-U-030 | "Ustawienia" ukryte dla `userRole='employee'` |

#### Grupa D: Kombinacje ról i features (NAV-U-031 do NAV-U-040)
| ID | Test Case |
|-----|-----------|
| NAV-U-031 | Admin z pełnymi features widzi wszystkie 9 pozycji menu |
| NAV-U-032 | Admin bez żadnych features widzi 6 pozycji (Kalendarz, Rezerwacje, Klienci, Powiadomienia, Ustawienia) |
| NAV-U-033 | Employee z pełnymi features widzi 6 pozycji (bez Hale, Protokoły, Ustawienia) |
| NAV-U-034 | Employee bez features widzi 4 pozycje (Kalendarz, Rezerwacje, Klienci, Powiadomienia) |
| NAV-U-035 | Admin tylko z offers widzi 7 pozycji |
| NAV-U-036 | Admin tylko z hallView widzi 7 pozycji |
| NAV-U-037 | Employee tylko z offers widzi 5 pozycji |
| NAV-U-038 | Kolejność menu items jest zachowana (Kalendarz pierwszy, Ustawienia ostatnie) |
| NAV-U-039 | Menu items mają poprawne ikony |
| NAV-U-040 | Badge notification widoczny zarówno w głównym nav jak i Sheet |

### Plik: `src/components/admin/AdminSidebar.test.tsx` (nowy plik testujący część sidebar z AdminDashboard)

Ze względu na złożoność AdminDashboard, proponuję wyekstrahować logikę nawigacji do oddzielnego komponentu `AdminSidebar` lub testować bezpośrednio MobileBottomNav (który jest już wydzielony) i dodać integracyjne testy dla widoczności menu na desktop przez sprawdzenie warunków `hasFeature`.

#### Alternatywnie: rozszerzenie testów MobileBottomNav o testy responsywne

#### Grupa E: Responsywność (NAV-U-041 do NAV-U-050)
| ID | Test Case |
|-----|-----------|
| NAV-U-041 | Na mobile (375px) - MobileBottomNav jest widoczny |
| NAV-U-042 | Na desktop (1280px) - MobileBottomNav jest ukryty (lg:hidden) |
| NAV-U-043 | Sheet "Więcej" ma pełną szerokość na mobile |
| NAV-U-044 | Przyciski nawigacji mają odpowiedni rozmiar dotyku (min 48px) |
| NAV-U-045 | Centralny przycisk Plus jest wyróżniony wizualnie |

## Szczegóły techniczne

### Struktura pliku testowego
```typescript
// src/components/admin/MobileBottomNav.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import MobileBottomNav from "./MobileBottomNav";
import { setViewport } from "@/test/utils/viewport";

const TestWrapper = ({ children }) => (
  <I18nextProvider i18n={i18n}>
    {children}
  </I18nextProvider>
);

const defaultProps = {
  currentView: 'calendar' as const,
  onViewChange: vi.fn(),
  onAddReservation: vi.fn(),
  onLogout: vi.fn(),
  unreadNotificationsCount: 0,
  offersEnabled: false,
  followupEnabled: false,
  hallViewEnabled: false,
  protocolsEnabled: false,
  userRole: 'admin' as const,
  currentVersion: '1.0.0',
};

const renderNav = (props = {}) => {
  return render(
    <TestWrapper>
      <MobileBottomNav {...defaultProps} {...props} />
    </TestWrapper>
  );
};
```

### Mockowanie
- `vi.mock` dla i18next tłumaczeń (już skonfigurowane globalnie)
- `setViewport()` z `@/test/utils/viewport` dla testów responsywnych
- `userEvent` dla interakcji (kliknięcia, otwarcie Sheet)

### Asercje
- `screen.getByText()` / `queryByText()` dla widoczności
- `screen.getByRole('button')` dla przycisków
- `fireEvent.click()` / `userEvent.click()` dla interakcji
- `expect(mockFn).toHaveBeenCalledWith()` dla callbacków
- `toHaveClass()` dla sprawdzania stylów aktywności

## Szacowany zakres
- **1 nowy plik testowy**: `src/components/admin/MobileBottomNav.test.tsx`
- **~50 test cases** pokrywających wszystkie scenariusze
- **Czas implementacji**: ~30-45 minut

## Priorytet testów
1. Grupa C (Feature flags) - najważniejsza, bo dotyczy logiki biznesowej
2. Grupa D (Kombinacje) - weryfikacja edge cases
3. Grupa A (Podstawowe) - fundamentalne działanie
4. Grupa B (Sheet) - interaktywność
5. Grupa E (Responsywność) - dodatkowa walidacja
