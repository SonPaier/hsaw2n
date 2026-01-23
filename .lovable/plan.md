
# Plan naprawy testów E2E - Problem "kalendarz renderuje się bez stacji"

## 🔍 Zidentyfikowany problem

Analiza kodu ujawnia **problem wyścigu czasowego (race condition)**:

```
1. seedE2EReset()         → czyści wszystkie dane
2. seedE2EScenario()      → tworzy stacje i usługi (async w bazie)
3. loginAsAdmin()         → loguje i czeka na kalendarz
   ↳ waitForCalendarToLoad() → widzi admin-calendar
   ↳ ALE stations=[] (bo React jeszcze nie pobrał danych)
4. page.reload()          → próba "naprawienia" przez przeładowanie
```

**Główny błąd**: `loginAsAdmin()` kończy się sukcesem gdy `data-testid="admin-calendar"` jest widoczne, ale ten element renderuje się NAWET gdy `stations=[]`.

**Dodatkowo**: `waitForResponse()` używa `.catch()` który ignoruje brak odpowiedzi zamiast failować test.

## ✅ Plan naprawy

### Zmiana 1: Dodać warunek na kalendarz z załadowanymi stacjami

**Plik**: `e2e/fixtures/e2e-helpers.ts`

**Aktualna logika** (linie 188-205):
```typescript
export async function waitForCalendarToLoad(page: Page): Promise<void> {
  // Wait for stations API response (ale ignoruje błąd!)
  await page.waitForResponse(...).catch(() => console.log('Warning...'));
  
  // Czeka na kalendarz (zawsze się renderuje!)
  const calendar = page.locator('[data-testid="admin-calendar"]');
  await calendar.waitFor({ state: 'visible', timeout: MAX_WAIT });
  
  // Czeka na slot (ale catch ignoruje brak slotów!)
  const slots = page.locator('[data-testid="calendar-slot"]');
  await slots.first().waitFor(...).catch(() => console.log('Warning...'));
}
```

**Nowa logika**:
```typescript
export async function waitForCalendarToLoad(page: Page): Promise<void> {
  // Wait for stations API response - FAIL if no response
  const stationsResponse = await page.waitForResponse(
    resp => resp.url().includes('stations') && resp.status() === 200,
    { timeout: 15000 }
  );
  
  const stationsData = await stationsResponse.json();
  const stationCount = stationsData?.length ?? stationsData?.data?.length ?? 0;
  console.log(`[E2E] Stations API returned ${stationCount} stations`);
  
  if (stationCount === 0) {
    throw new Error('[E2E] Stations API returned empty array - seeding may have failed');
  }
  
  // Wait for calendar container
  const calendar = page.locator('[data-testid="admin-calendar"]');
  await calendar.waitFor({ state: 'visible', timeout: MAX_WAIT });
  
  // Wait for at least one calendar slot - REQUIRED
  const slots = page.locator('[data-testid="calendar-slot"]');
  await slots.first().waitFor({ state: 'attached', timeout: 15000 });
  
  const slotCount = await slots.count();
  console.log(`[E2E] Calendar loaded with ${slotCount} slots`);
  
  if (slotCount === 0) {
    await page.screenshot({ path: 'test-results/debug-no-slots.png' });
    throw new Error('[E2E] Calendar has no slots - stations may not have loaded');
  }
}
```

### Zmiana 2: Usunąć nadmiarowy reload z testu

**Plik**: `e2e/reservation-flow.spec.ts`

**Aktualna logika** (linie 37-73):
```typescript
await loginAsAdmin(page);
await expect(page).not.toHaveURL(/\/login/);

// Reload to fetch seeded data  ← ZBĘDNY jeśli loginAsAdmin czeka poprawnie
await page.reload({ waitUntil: 'networkidle' });
```

**Nowa logika**:
```typescript
await loginAsAdmin(page);
await expect(page).not.toHaveURL(/\/login/);

// loginAsAdmin już czeka na stations response i slots
// NIE potrzeba dodatkowego reload
console.log('✅ Logged in and calendar loaded with stations');
```

### Zmiana 3: Dodać retry dla waitForResponse gdy dane nie są gotowe

**Plik**: `e2e/fixtures/e2e-helpers.ts`

Dodać funkcję pomocniczą:
```typescript
async function waitForStationsWithRetry(page: Page, maxRetries = 3): Promise<number> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Trigger stations fetch
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    const response = await page.waitForResponse(
      resp => resp.url().includes('stations') && resp.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);
    
    if (response) {
      const data = await response.json().catch(() => ({}));
      const count = Array.isArray(data) ? data.length : data?.data?.length ?? 0;
      
      if (count > 0) {
        console.log(`[E2E] Attempt ${attempt}: Found ${count} stations`);
        return count;
      }
    }
    
    console.log(`[E2E] Attempt ${attempt}: No stations found, retrying...`);
    await page.waitForTimeout(1000);
  }
  
  throw new Error(`[E2E] No stations found after ${maxRetries} attempts`);
}
```

### Zmiana 4: Upewnić się że seed jest ZAKOŃCZONY przed logowaniem

**Plik**: `e2e/reservation-flow.spec.ts`

Dodać weryfikację seedowania:
```typescript
console.log('🌱 Seeding basic scenario (stations, services)...');
const seedResult = await seedE2EScenario('basic');

// Upewnij się że seed zwrócił stacje
if (!seedResult.created?.stationIds?.length) {
  throw new Error(`Seeding failed: no stationIds in result: ${JSON.stringify(seedResult)}`);
}
console.log(`✅ Seeded ${seedResult.created.stationIds.length} stations, ${seedResult.created.serviceIds?.length ?? 0} services`);

// Krótka pauza żeby baza danych miała czas propagować dane
await new Promise(r => setTimeout(r, 500));

await loginAsAdmin(page);
```

## 📁 Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `e2e/fixtures/e2e-helpers.ts` | Zmodyfikuj `waitForCalendarToLoad()` - usunięcie `.catch()`, dodanie walidacji count |
| `e2e/reservation-flow.spec.ts` | Usunięcie `reload()`, dodanie walidacji seed result |

## 🧪 Oczekiwany rezultat

Po tych zmianach:
1. **Test failuje szybko** jeśli stacje nie załadowały się (zamiast flaky pass)
2. **Brak race condition** - czekamy na prawdziwe dane, nie na pusty kontener
3. **Lepsze debugowanie** - screenshoty i logi pokazują dokładnie co poszło nie tak

## 📊 Estymacja

- **Czas implementacji**: ~20-30 minut
- **Ryzyko**: Niskie (zmiany tylko w testach, nie w produkcji)
