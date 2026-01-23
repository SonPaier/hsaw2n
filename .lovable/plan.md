
# Plan: Strategia testowania responsywności UI (mobile/tablet/desktop)

## Analiza obecnego stanu

### Wzorce responsywności w projekcie:
1. **Hook `useIsMobile`** - zwraca `true` gdy `window.innerWidth < 768px`
2. **Conditional rendering** - np. w `ProductsView`:
   - Mobile (linie 422-502): layout kartowy
   - Desktop (linie 503-607): layout tabelowy
3. **CSS-only responsiveness** - klasy Tailwind jak `hidden sm:inline`, `flex-col sm:flex-row`
4. **Różna paginacja** - mobile pokazuje tylko `X / Y`, desktop ma też selektor ilości na stronę

### Typowe różnice UI (mobile vs desktop):
| Aspekt | Mobile | Desktop |
|--------|--------|---------|
| Listy produktów | Karty | Tabela |
| Przyciski akcji | Tylko ikony | Ikona + tekst |
| Paginacja | Prosta | Z selektorem page size |
| Nawigacja | Bottom nav bar | Sidebar/Top bar |
| Dialogi | Fullscreen drawer | Centered modal |

---

## Proponowane podejście do testów

### 1. Utility do mockowania viewport

Utworzenie helpera `setViewport` w `src/test/utils/viewport.ts`:

```text
// Trzy predefiniowane viewporty
MOBILE:  375 x 667  (iPhone SE)
TABLET:  768 x 1024 (iPad)
DESKTOP: 1280 x 800 (Laptop)

// Helper funkcja
setViewport('mobile' | 'tablet' | 'desktop')
  -> ustawia window.innerWidth
  -> aktualizuje matchMedia mock
  -> wywołuje resize event
```

### 2. Struktura testów - hierarchiczna

Zamiast duplikować 100% testów, dzielimy je na warstwy:

```text
tests/
├── logika biznesowa (1x) - niezależna od viewport
│   └── walidacja, API calls, state management
│
├── core UI (1x) - testowane na desktop
│   └── czy elementy są obecne, interakcje działają
│
└── viewport-specific (per viewport) - tylko różnice
    ├── mobile: karty zamiast tabel, ukryty tekst
    ├── tablet: layout hybrydowy
    └── desktop: pełne kolumny, page size selector
```

### 3. Wzorzec: `describe.each` z viewportami

```text
const VIEWPORTS = ['mobile', 'tablet', 'desktop'] as const;

describe.each(VIEWPORTS)('ProductsList - %s', (viewport) => {
  beforeEach(() => setViewport(viewport));

  it('renders product list', ...);  // wspólna logika

  if (viewport === 'mobile') {
    it('shows card layout', ...);
    it('hides button text', ...);
  }

  if (viewport === 'desktop') {
    it('shows table layout', ...);
    it('shows page size selector', ...);
  }
});
```

### 4. Alternatywa: Matchers warunkowe

```text
it('renders products appropriately for viewport', () => {
  setViewport('mobile');
  render(<ProductsView />);

  // Mobile: karty
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getAllByTestId('product-card')).toHaveLength(20);

  cleanup();

  setViewport('desktop');
  render(<ProductsView />);

  // Desktop: tabela
  expect(screen.getByRole('table')).toBeInTheDocument();
});
```

---

## Implementacja

### Krok 1: Viewport utility
Plik: `src/test/utils/viewport.ts`

- Eksportuje funkcję `setViewport(size)`
- Aktualizuje `window.innerWidth` i `innerHeight`
- Dispatchuje `resize` event
- Aktualizuje mock `matchMedia` aby zwracał poprawną wartość `matches`

### Krok 2: Aktualizacja setup.ts
- Import viewport utility
- Reset do desktop przed każdym testem (domyślny viewport)

### Krok 3: Testy InstanceAuth - rozszerzenie o viewport
Plik: `src/pages/InstanceAuth.test.tsx`

Dodatkowe przypadki:
| ID | Viewport | Przypadek |
|----|----------|-----------|
| LA-U-017 | mobile | Footer links stack vertically (flex-col) |
| LA-U-018 | desktop | Decorative right panel is visible (lg:flex) |
| LA-U-019 | mobile | Decorative right panel is hidden |

### Krok 4: Template dla przyszłych testów

Szablon `src/test/templates/responsive-component.test.template.tsx`:
```text
// 1. Import viewport utility
// 2. describe.each dla viewportów
// 3. Logika biznesowa (1x)
// 4. Viewport-specific assertions
```

---

## Korzyści tego podejścia

1. **Brak duplikacji** - logika biznesowa testowana raz
2. **Czytelność** - jasne co jest wspólne, a co viewport-specific
3. **Łatwe utrzymanie** - zmiana w viewport utility wpływa wszędzie
4. **Izolacja** - `beforeEach` resetuje viewport, testy się nie psują wzajemnie
5. **Elastyczność** - można dodać tablet tylko tam gdzie ma sens

---

## Techniczne szczegóły

### Viewport helper implementacja

```text
src/test/utils/viewport.ts

export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

export function setViewport(size: keyof typeof VIEWPORTS) {
  const { width, height } = VIEWPORTS[size];

  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

  // Update matchMedia mock
  window.matchMedia = (query: string) => ({
    matches: query.includes('max-width') 
      ? width <= parseInt(query.match(/\d+/)?.[0] || '0')
      : width >= parseInt(query.match(/\d+/)?.[0] || '0'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    // ... other required methods
  });

  // Trigger resize
  window.dispatchEvent(new Event('resize'));
}
```

### Modyfikacja setup.ts

```text
// Po istniejącym matchMedia mock:
import { setViewport } from './utils/viewport';

beforeEach(() => {
  setViewport('desktop'); // Reset do domyślnego
});
```

---

## Rekomendacja

Proponuję podejście hybrydowe:

1. **Dla logiki biznesowej** - jeden test, bez viewport
2. **Dla layoutu** - `describe.each` z mobile/desktop (tablet opcjonalnie)
3. **Dla drobnych różnic CSS** - jeden test z wieloma asercjami

To daje balans między pokryciem a utrzymywalnością testów.
