
# Plan naprawy - alternatywne selektory dla kalendarza

## 🔍 Zidentyfikowany problem

`waitForResponse()` w Playwright czeka na **nowe** odpowiedzi HTTP wysyłane **PO** włączeniu nasłuchu. Jeśli strona już pobrała `/stations` podczas nawigacji, funkcja czeka na timeout.

## ✅ Rozwiązanie - użycie selektorów CSS zamiast waitForResponse

### Zmiana w `e2e/fixtures/e2e-helpers.ts`

**Aktualna logika (błędna):**
```typescript
export async function waitForCalendarToLoad(page: Page): Promise<void> {
  // ❌ PROBLEM: waitForResponse czeka na NOWE requesty
  const stationsResponse = await page.waitForResponse(
    resp => resp.url().includes('/stations') && resp.status() === 200,
    { timeout: 15000 }
  );
  // ...
}
```

**Nowa logika (z selektorami CSS):**
```typescript
export async function waitForCalendarToLoad(page: Page): Promise<void> {
  const MAX_WAIT = process.env.CI ? 60000 : 30000;
  
  console.log('[E2E] Waiting for calendar container...');
  
  // Czekaj na dowolny z tych selektorów - kalendarz może mieć data-testid lub nie
  const calendarSelector = '[data-testid="admin-calendar"], div.flex.flex-col.h-full.bg-card.rounded-xl';
  await page.waitForSelector(calendarSelector, { state: 'visible', timeout: MAX_WAIT });
  console.log('[E2E] Calendar container visible');
  
  // Czekaj na sloty - to gwarantuje że stacje są załadowane
  const slots = page.locator('[data-testid="calendar-slot"]');
  
  // Retry logic - czasami React potrzebuje chwili na re-render po danych
  let slotCount = 0;
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    slotCount = await slots.count();
    if (slotCount > 0) {
      console.log(`[E2E] Attempt ${attempt}: Found ${slotCount} slots`);
      break;
    }
    console.log(`[E2E] Attempt ${attempt}: No slots yet, waiting 500ms...`);
    await page.waitForTimeout(500);
  }
  
  if (slotCount === 0) {
    // Debugowanie - sprawdź czy są jakieś stacje w DOM
    const stationHeaders = await page.locator('[class*="station"], th, .station-header').count();
    console.log(`[E2E] Station headers found: ${stationHeaders}`);
    
    await page.screenshot({ path: 'test-results/debug-no-slots.png' }).catch(() => {});
    throw new Error('[E2E] Calendar has no slots after 5s - stations may not have loaded');
  }
  
  console.log(`[E2E] ✅ Calendar loaded with ${slotCount} slots`);
}
```

### Zmiana selektora kalendarza w `loginAsAdmin`

Dodać obsługę obu selektorów:
```typescript
// W przypadku gdy nie ma data-testid, fallback do klas CSS
const calendarVisible = await page.locator(
  '[data-testid="admin-calendar"], .flex.flex-col.h-full.bg-card.rounded-xl'
).isVisible({ timeout: 5000 }).catch(() => false);
```

## 📁 Plik do modyfikacji

| Plik | Zmiany |
|------|--------|
| `e2e/fixtures/e2e-helpers.ts` | Usunięcie `waitForResponse`, dodanie retry-based slot detection |

## 🧪 Kluczowe zmiany

1. **Usunięcie `waitForResponse`** - nie jest niezawodny dla już wykonanych requestów
2. **Dodanie retry loop dla slotów** - czekanie 10x500ms = 5s na pojawienie się slotów
3. **Fallback selektor CSS** - `div.flex.flex-col.h-full.bg-card.rounded-xl` jako alternatywa dla `data-testid`
4. **Lepsze debugowanie** - screenshoty i logi przy błędach

## ⏱️ Estymacja

~10 minut na implementację
