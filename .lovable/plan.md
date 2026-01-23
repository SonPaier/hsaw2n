
# Plan: Konfiguracja Vitest + React Testing Library + Pierwszy test E2E

## Cel
Skonfigurować infrastrukturę testową z Vitest i React Testing Library, napisać pierwszy unit test dla `phoneUtils.ts`, oraz test E2E dla pełnego flow dodawania rezerwacji przez admina.

---

## Część 1: Konfiguracja Vitest

### 1.1 Instalacja zależności
Dodanie do `devDependencies` w `package.json`:
- `vitest` ^3.2.4
- `@testing-library/react` ^16.0.0
- `@testing-library/jest-dom` ^6.6.0
- `jsdom` ^20.0.3

### 1.2 Nowy plik: `vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/hooks/**', 'src/components/**'],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

### 1.3 Nowy plik: `src/test/setup.ts`
Setup dla testów React z matchMedia mock (wymagane dla komponentów używających media queries).

### 1.4 Aktualizacja `tsconfig.app.json`
Dodanie `"vitest/globals"` do `types` w `compilerOptions`.

### 1.5 Dodanie skryptów do `package.json`
```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

---

## Część 2: Pierwszy Unit Test - phoneUtils

### 2.1 Nowy plik: `src/lib/phoneUtils.test.ts`

Konwencja nazewnictwa: `PU-U-XXX` (PhoneUtils-Unit-numer)

```typescript
// PU-U-001: normalizePhone - polskie numery 9-cyfrowe
// PU-U-002: normalizePhone - prefix +48
// PU-U-003: normalizePhone - prefix 0048
// PU-U-004: normalizePhone - numery międzynarodowe
// PU-U-005: stripPhone - usuwa wszystkie znaki
// PU-U-006: isValidPhone - walidacja długości
// PU-U-007: formatPhoneDisplay - formatowanie polskie
// PU-U-008: formatPhoneDisplay - formatowanie międzynarodowe
```

Przykładowa struktura:
```typescript
describe('phoneUtils', () => {
  describe('normalizePhone', () => {
    it('PU-U-001: normalizes 9-digit Polish number to E.164', () => {
      expect(normalizePhone('733854184')).toBe('+48733854184');
    });
  });
});
```

---

## Część 3: Test E2E - Pełny flow rezerwacji

### 3.1 Nowy katalog i plik: `e2e/reservation-flow.spec.ts`

Konwencja: `RF-E2E-XXX` (ReservationFlow-E2E-numer)

**Scenariusz RF-E2E-001: Admin dodaje rezerwację i widzi ją na kalendarzu**

```text
1. [Setup] Wywołanie seed-e2e-reset (czyszczenie)
2. [Setup] Wywołanie seed-e2e-scenario z "basic" (stanowiska, usługi)
3. Nawigacja do /e2e (instancja e2e)
4. Logowanie jako admin e2e
5. Kliknięcie "Dodaj rezerwację"
6. Wypełnienie formularza:
   - Telefon: 111222333
   - Imię: Test E2E
   - Samochód: BMW X5, WE E2E01
   - Usługa: pierwsza dostępna
   - Data: dzisiaj
   - Godzina: 10:00
7. Zapisanie rezerwacji
8. Weryfikacja: toast sukcesu
9. Weryfikacja: rezerwacja widoczna na kalendarzu z danymi klienta
```

### 3.2 Helper: `e2e/fixtures/e2e-helpers.ts`
```typescript
// Funkcja do wywoływania seed-e2e-reset
// Funkcja do wywoływania seed-e2e-scenario
// Dane logowania admina e2e
```

---

## Część 4: Struktura plików (podsumowanie)

```text
project/
├── vitest.config.ts                    # NOWY
├── package.json                        # EDYCJA (zależności + skrypty)
├── tsconfig.app.json                   # EDYCJA (types)
├── src/
│   ├── test/
│   │   └── setup.ts                    # NOWY
│   ├── lib/
│   │   ├── phoneUtils.ts
│   │   └── phoneUtils.test.ts          # NOWY
│   └── components/
│       └── admin/
│           ├── AddReservationDialogV2.tsx
│           └── AddReservationDialogV2.test.tsx  # PRZYSZŁY
└── e2e/
    ├── fixtures/
    │   └── e2e-helpers.ts              # NOWY
    └── reservation-flow.spec.ts        # NOWY
```

---

## Część 5: Konwencje i wytyczne

| Typ testu | Prefix | Przykład | Cel czasu |
|-----------|--------|----------|-----------|
| Unit | XX-U-NNN | PU-U-001 | < 1s |
| Integration | XX-I-NNN | RD-I-001 | < 5s |
| E2E | XX-E2E-NNN | RF-E2E-001 | < 30s |

**Skróty komponentów:**
- PU = PhoneUtils
- TU = TextUtils  
- RD = ReservationDialog
- RF = ReservationFlow

---

## Część techniczna

### Zależności do zainstalowania
```json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^20.0.3"
  }
}
```

### Konfiguracja E2E token
Token jest już skonfigurowany: `a3f8b2c4...` - będzie użyty w helperze `e2e-helpers.ts` poprzez zmienną środowiskową `E2E_SEED_TOKEN`.

### Mock Supabase dla unit testów
Dla testów komponentów używających Supabase, stworzymy mock w `src/test/mocks/supabase.ts` (w przyszłych testach integracyjnych).

---

## Kolejność implementacji

1. Konfiguracja Vitest (vitest.config.ts, setup.ts, package.json, tsconfig)
2. Unit testy phoneUtils.test.ts 
3. E2E helpers (e2e-helpers.ts)
4. E2E test reservation-flow.spec.ts

Po zatwierdzeniu planu, zaczynam od kroku 1.
