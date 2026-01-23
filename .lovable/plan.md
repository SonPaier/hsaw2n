
# Plan poprawek testów E2E - Reservation Happy Path

## Podsumowanie analizy

Raport Claude identyfikuje **15 słabości** w testach E2E. Kluczowe problemy:

1. **Brak weryfikacji URL/stanu po logowaniu** - główna przyczyna awarii
2. **Jeden mega-test zamiast wielu mniejszych** - trudne debugowanie
3. **Magiczne timeouty** - flaky tests
4. **Słabe selektory z `.first()` i fallbackami** - niestabilne
5. **Brak weryfikacji że akcje faktycznie zmieniły stan** - false positives

---

## Priorytet 1: Naprawa głównego błędu (kalendarz nie ładuje się)

### Zmiany w `e2e/fixtures/e2e-helpers.ts`

**1.1 Weryfikacja seedowania przed testem:**
```typescript
export async function seedE2EScenario(scenario: '...') {
  // ... fetch ...
  const result = await response.json();
  
  // NOWE: Walidacja wyniku
  if (!result.success) {
    throw new Error(`Seed failed: ${JSON.stringify(result)}`);
  }
  if (scenario === 'basic') {
    const created = result.created || {};
    if (!created.stations || created.stations < 2) {
      throw new Error(`Seed incomplete: expected 2+ stations, got ${created.stations}`);
    }
    if (!created.services || created.services < 1) {
      throw new Error(`Seed incomplete: expected 1+ services, got ${created.services}`);
    }
  }
  return result;
}
```

**1.2 Weryfikacja URL po logowaniu:**
```typescript
export async function loginAsAdmin(page: Page, clearStorage = true): Promise<void> {
  // ... existing login code ...
  
  // NOWE: Explicit URL check after login
  await page.waitForURL(/\/admin(\/|\?|$)/, { timeout: MAX_WAIT });
  console.log(`[E2E] Logged in, current URL: ${page.url()}`);
  
  // NOWE: Wait for stations API response before looking for calendar
  await page.waitForResponse(
    resp => resp.url().includes('/stations') && resp.status() === 200,
    { timeout: 15000 }
  ).catch(() => console.log('[E2E] Warning: stations response not detected'));
  
  const calendar = page.locator('[data-testid="admin-calendar"]');
  await calendar.waitFor({ state: 'visible', timeout: MAX_WAIT });
}
```

---

## Priorytet 2: Lepsze selektory (usunięcie `.first()` i fallbacków)

### Dodanie data-testid w komponentach (jeśli brakuje)

**2.1 Aktualizacja `AddReservationDialogV2.tsx`:**
- `data-testid="phone-input"` na polu telefonu
- `data-testid="name-input"` na polu imienia
- `data-testid="car-model-input"` na polu modelu
- `data-testid="plate-input"` na polu rejestracji
- `data-testid="admin-notes-input"` na textarea notatek
- `data-testid="save-reservation-btn"` na przycisku zapisz

**2.2 Aktualizacja `e2e-helpers.ts` - nowe selektory:**
```typescript
// PRZED:
const phoneInput = page.locator(
  'input[name="phone"], input[placeholder*="Telefon"], [data-testid="phone-input"]'
).first();

// PO:
const phoneInput = page.getByTestId('phone-input');
```

**2.3 Lista selektorów do uproszczenia:**
| Stary selektor | Nowy selektor |
|----------------|---------------|
| `input[name="phone"], ...`.first() | `page.getByTestId('phone-input')` |
| `input[name="name"], ...`.first() | `page.getByTestId('name-input')` |
| `button:has-text("Zapisz"), ...`.first() | `page.getByTestId('save-reservation-btn')` |
| `textarea[name="adminNotes"], ...`.first() | `page.getByTestId('admin-notes-input')` |

---

## Priorytet 3: Usunięcie magicznych timeoutów

### Zamiana `waitForTimeout` na konkretne zdarzenia

**3.1 Po wypełnieniu telefonu:**
```typescript
// PRZED:
await phoneInput.fill(data.phone);
await page.keyboard.press('Tab');
await page.waitForTimeout(500);

// PO:
await phoneInput.fill(data.phone);
await phoneInput.blur();
// Czekaj na zakończenie lookupa klienta (spinner lub wynik)
await page.locator('[data-testid="customer-lookup-complete"]').waitFor({ 
  state: 'attached', 
  timeout: 5000 
}).catch(() => {});
```

**3.2 Po zapisaniu rezerwacji:**
```typescript
// PRZED:
await saveButton.click();
await page.waitForTimeout(1000);

// PO:
await saveButton.click();
await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
await expect(page.getByTestId('reservation-card').filter({ hasText: customerName }))
  .toBeVisible({ timeout: 5000 });
```

**3.3 Po zmianie statusu:**
```typescript
// PRZED:
await startButton.click();
await page.waitForTimeout(1000);

// PO:
await startButton.click();
await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 3000 });
```

---

## Priorytet 4: Rozdzielenie mega-testu na mniejsze

### Nowa struktura plików

```
e2e/
  fixtures/
    e2e-helpers.ts          # Helpers (bez zmian w strukturze)
  reservation/
    01-login.spec.ts        # Test logowania
    02-create.spec.ts       # Test tworzenia rezerwacji
    03-details.spec.ts      # Test widoku szczegółów
    04-edit.spec.ts         # Test edycji
    05-status.spec.ts       # Test zmiany statusu
    06-drag-drop.spec.ts    # Test drag & drop
  reservation-flow.spec.ts  # (opcjonalnie zachowany jako smoke test)
```

### Shared state między testami

```typescript
// e2e/reservation/fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{
  seededInstance: { stationIds: string[]; serviceIds: string[] };
  loggedInPage: Page;
}>({
  seededInstance: async ({}, use) => {
    await seedE2EReset();
    const result = await seedE2EScenario('basic');
    await use({
      stationIds: result.created.stationIds,
      serviceIds: result.created.serviceIds,
    });
  },
  loggedInPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },
});
```

### Przykład pojedynczego testu

```typescript
// e2e/reservation/02-create.spec.ts
import { test, expect } from './fixtures';

test.describe('Create Reservation', () => {
  test('should create reservation by clicking on calendar slot', async ({ loggedInPage, seededInstance }) => {
    const page = loggedInPage;
    
    // Click on 10:00 slot on first station
    const slot = page.getByTestId('calendar-slot')
      .filter({ hasAttribute: `data-station="${seededInstance.stationIds[0]}"` })
      .filter({ hasAttribute: 'data-time="10:00"' });
    await slot.click();
    
    // Fill form
    await page.getByTestId('phone-input').fill('111222333');
    await page.getByTestId('name-input').fill('Test E2E');
    await page.getByTestId('car-model-input').fill('BMW X5');
    
    // Select service
    await page.getByTestId('service-item').first().click();
    
    // Save
    await page.getByTestId('save-reservation-btn').click();
    
    // Verify
    await expect(page.getByTestId('success-toast')).toBeVisible();
    await expect(page.getByTestId('reservation-card').filter({ hasText: 'Test E2E' }))
      .toBeVisible();
  });
});
```

---

## Priorytet 5: Weryfikacja stanu po akcjach

### Dodanie asercji na rzeczywiste zmiany

**5.1 Po utworzeniu rezerwacji:**
```typescript
// Sprawdź że rezerwacja jest na kalendarzu
await expect(page.getByTestId('reservation-card').filter({ hasText: customerName }))
  .toBeVisible({ timeout: 5000 });

// Sprawdź że ma poprawny czas
const cardText = await page.getByTestId('reservation-card')
  .filter({ hasText: customerName })
  .textContent();
expect(cardText).toContain('10:00');
```

**5.2 Po drag & drop:**
```typescript
// Użyj Playwright API zamiast raw mouse events
await reservationCard.dragTo(targetSlot);

// Sprawdź nową pozycję
await expect(reservationCard).toHaveAttribute('data-station', stationIdArray[1]);
// lub sprawdź czas w draweru
await reservationCard.click();
const timeDisplay = page.getByTestId('reservation-time');
await expect(timeDisplay).toContainText('12:30');
```

**5.3 Po edycji:**
```typescript
await notesField.fill('Updated via E2E test');
await saveButton.click();

// Re-open drawer and verify
await reservationCard.click();
const notes = page.getByTestId('admin-notes-display');
await expect(notes).toContainText('Updated via E2E test');
```

---

## Szczegóły techniczne

### Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `e2e/fixtures/e2e-helpers.ts` | Walidacja seedowania, lepsze selektory, usunięcie timeoutów |
| `e2e/reservation-flow.spec.ts` | Refaktor na mniejsze testy lub zachowanie jako smoke test |
| `src/components/admin/AddReservationDialogV2.tsx` | Dodanie data-testid |
| `src/components/admin/ReservationDetailsDrawer.tsx` | Dodanie data-testid |
| `src/components/admin/AdminCalendar.tsx` | Weryfikacja data-testid="admin-calendar" |

### Nowe pliki do utworzenia

| Plik | Opis |
|------|------|
| `e2e/reservation/fixtures.ts` | Shared fixtures dla testów rezerwacji |
| `e2e/reservation/01-login.spec.ts` | Izolowany test logowania |
| `e2e/reservation/02-create.spec.ts` | Izolowany test tworzenia |
| `e2e/reservation/03-details.spec.ts` | Izolowany test szczegółów |
| `e2e/reservation/04-edit.spec.ts` | Izolowany test edycji |
| `e2e/reservation/05-status.spec.ts` | Izolowany test statusów |
| `e2e/reservation/06-drag-drop.spec.ts` | Izolowany test D&D |

### Estymowany zakres prac

- **Priorytet 1** (naprawa głównego błędu): ~20 minut
- **Priorytet 2** (selektory): ~30 minut  
- **Priorytet 3** (timeouty): ~20 minut
- **Priorytet 4** (rozdzielenie testów): ~45 minut
- **Priorytet 5** (asercje): ~20 minut

**Łącznie: ~2.5 godziny pracy**

---

## Szybka naprawa (Quick Fix)

Jeśli chcesz naprawić tylko główny problem (kalendarz nie ładuje się), wystarczy:

1. Dodać walidację seedowania w `seedE2EScenario()`
2. Dodać `waitForResponse` na `/stations` przed szukaniem kalendarza
3. Dodać explicit `waitForURL` po logowaniu

To powinno rozwiązać 80% problemów z obecnym testem.
