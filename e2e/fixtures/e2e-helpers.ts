import { Page } from '@playwright/test';

// E2E Instance configuration
export const E2E_CONFIG = {
  instanceSlug: 'e2e',
  instanceId: '3ba42fcc-3bd4-4330-99dd-bf0a6a4edbf1',
  supabaseUrl: 'https://vklavozvzfqhxzoczqnp.supabase.co',
  // Token is stored in environment variable for security
  getToken: () => process.env.E2E_SEED_TOKEN || 'a3f8b2c4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
};

// Admin credentials for E2E testing
// IMPORTANT: In CI, use GitHub Secrets (E2E_ADMIN_USERNAME, E2E_ADMIN_PASSWORD)
export const E2E_ADMIN = {
  username: process.env.E2E_ADMIN_USERNAME || 'admine2e',
  password: process.env.E2E_ADMIN_PASSWORD || 'bbE9475A!dd4as_!x#',
};

/**
 * Resets all data for the E2E instance.
 * Clears: reservations, customers, vehicles, breaks, stations, services, etc.
 */
export async function seedE2EReset(): Promise<{ success: boolean; deleted: Record<string, number> }> {
  const response = await fetch(`${E2E_CONFIG.supabaseUrl}/functions/v1/seed-e2e-reset`, {
    method: 'POST',
    headers: {
      'X-E2E-Token': E2E_CONFIG.getToken(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`seed-e2e-reset failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Seeds E2E instance with a specific scenario.
 * 
 * Scenarios:
 * - "basic": Stations, service categories, services
 * - "with_reservations": Basic + customers, vehicles, reservations
 * - "with_offers": Basic + offers with various statuses
 * - "full": All of the above
 */
export async function seedE2EScenario(
  scenario: 'basic' | 'with_reservations' | 'with_offers' | 'full'
): Promise<{ success: boolean; created: Record<string, unknown> }> {
  const response = await fetch(`${E2E_CONFIG.supabaseUrl}/functions/v1/seed-e2e-scenario`, {
    method: 'POST',
    headers: {
      'X-E2E-Token': E2E_CONFIG.getToken(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`seed-e2e-scenario failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Clears browser storage (localStorage, sessionStorage) to ensure clean login.
 */
export async function clearBrowserStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  console.log('[E2E] Browser storage cleared');
}

/**
 * Logs in as admin to the E2E instance.
 * Navigates to login page, fills credentials, and waits for dashboard.
 */
export async function loginAsAdmin(page: Page, clearStorage = true): Promise<void> {
  // Clear storage before login to avoid stale tokens
  if (clearStorage) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await clearBrowserStorage(page);
  }
  
  // Navigate to login page (on subdomain e2e.admin.n2wash.com, login is at /login)
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Use strict data-testid selector for calendar
  const calendar = page.locator('[data-testid="admin-calendar"]');

  // Prefer robust, accessibility-based selectors
  const usernameInput = page.getByLabel(/login/i).first();
  const passwordInput = page.getByLabel(/hasło/i).first();
  const submitButton = page.getByRole('button', { name: /zaloguj/i }).first();

  console.log('[E2E] loginAsAdmin url:', page.url());

  // Cold start: wait until either dashboard already visible OR login form appears.
  const MAX_WAIT = process.env.CI ? 60000 : 30000;

  await Promise.race([
    calendar.waitFor({ state: 'visible', timeout: MAX_WAIT }).catch(() => {}),
    usernameInput.waitFor({ state: 'visible', timeout: MAX_WAIT }).catch(() => {}),
  ]);

  // If already logged in, we're done.
  if (await calendar.isVisible().catch(() => false)) return;

  // If we are still on a loader, wait a bit longer for the form.
  const spinner = page.locator('[class*="animate-spin"], svg.animate-spin').first();
  if (await spinner.isVisible().catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout: MAX_WAIT }).catch(() => {});
  }

  await usernameInput.waitFor({ state: 'visible', timeout: MAX_WAIT });
  await passwordInput.waitFor({ state: 'visible', timeout: MAX_WAIT });

  await usernameInput.fill(E2E_ADMIN.username);
  await passwordInput.fill(E2E_ADMIN.password);

  await submitButton.click();

  // Wait for dashboard to load (calendar view)
  await calendar.waitFor({ state: 'visible', timeout: MAX_WAIT });
}

/**
 * Opens the "Add Reservation" dialog by clicking on a time slot in the calendar grid.
 * On desktop, reservations are added by clicking on an empty time slot, not via a button.
 */
export async function openAddReservationDialog(page: Page): Promise<void> {
  console.log('[E2E] openAddReservationDialog: looking for calendar time slots...');
  
  // Wait for calendar grid to be fully loaded
  await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
    timeout: 10000,
  });
  
  // Find clickable time slots in the calendar grid (enabled slots only)
  const timeSlots = page.locator('[data-testid="calendar-slot"]:not([data-disabled="true"])');
  const slotCount = await timeSlots.count();
  console.log(`[E2E] Found ${slotCount} clickable time slot elements`);
  
  if (slotCount > 0) {
    // Click on a slot around 10:00 - find by data-time attribute
    const slot1000 = page.locator('[data-testid="calendar-slot"][data-time="10:00"]:not([data-disabled="true"])').first();
    const has1000 = await slot1000.count() > 0;
    
    if (has1000) {
      await slot1000.click();
      console.log('[E2E] Clicked on 10:00 slot');
    } else {
      // Fallback to first available slot
      await timeSlots.first().click();
      console.log('[E2E] Clicked on first available slot');
    }
  } else {
    // Fallback: try clicking directly on the calendar grid area
    // The grid cells are clickable divs in the time column
    console.log('[E2E] No explicit slots found, trying direct grid click...');
    
    // Look for the calendar content area (station columns)
    const calendarContent = page.locator('.calendar-content, [class*="calendar"] > div').first();
    
    if (await calendarContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click in the center of the calendar, slightly below the header
      const box = await calendarContent.boundingBox();
      if (box) {
        // Click at around 10:00 position (assuming 8:00-20:00 working hours)
        const clickY = box.y + box.height * 0.2; // ~20% from top for 10:00
        const clickX = box.x + box.width * 0.3; // First station column
        await page.mouse.click(clickX, clickY);
        console.log(`[E2E] Clicked on calendar at (${clickX}, ${clickY})`);
      }
    } else {
      // Last resort: try the add button (for mobile or alternative layouts)
      const addButton = page.locator('button:has-text("Dodaj rezerwację"), button:has-text("Nowa rezerwacja"), [data-testid="add-reservation-btn"], button:has(.lucide-plus)');
      const addButtonCount = await addButton.count();
      console.log(`[E2E] Add button fallback matched ${addButtonCount} elements`);
      
      if (addButtonCount > 0) {
        await addButton.first().click();
        console.log('[E2E] Clicked add button as fallback');
      } else {
        await page.screenshot({ path: 'test-results/debug-add-button.png' }).catch(() => {});
        throw new Error('[E2E] Could not find way to add reservation');
      }
    }
  }
  
  // Wait for dialog to open
  await page.waitForSelector('[role="dialog"], [data-testid="reservation-dialog"]', { timeout: 5000 });
  console.log('[E2E] Dialog opened successfully');
}

/**
 * Fills the reservation form with provided data.
 */
export async function fillReservationForm(
  page: Page,
  data: {
    phone: string;
    name: string;
    carModel?: string;
    plate?: string;
  }
): Promise<void> {
  // Fill phone number
  const phoneInput = page.locator('input[name="phone"], input[placeholder*="Telefon"], [data-testid="phone-input"]');
  await phoneInput.first().fill(data.phone);
  
  // Wait for customer lookup or trigger blur
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  
  // Fill name if editable
  const nameInput = page.locator('input[name="name"], input[placeholder*="Imię"], [data-testid="name-input"]');
  if (await nameInput.first().isVisible()) {
    await nameInput.first().fill(data.name);
  }
  
  // Fill car model if provided
  if (data.carModel) {
    const carInput = page.locator('input[name="model"], input[placeholder*="Model"], [data-testid="car-input"]');
    if (await carInput.first().isVisible()) {
      await carInput.first().fill(data.carModel);
    }
  }
  
  // Fill plate if provided
  if (data.plate) {
    const plateInput = page.locator('input[name="plate"], input[placeholder*="Rejestracja"], [data-testid="plate-input"]');
    if (await plateInput.first().isVisible()) {
      await plateInput.first().fill(data.plate);
    }
  }
}

/**
 * Selects the first available service in the form.
 */
export async function selectFirstService(page: Page): Promise<void> {
  // Look for service selection area
  const serviceButton = page.locator('[data-testid="service-item"], .service-card, button:has-text("Wybierz usługę")');
  
  if (await serviceButton.first().isVisible()) {
    await serviceButton.first().click();
  }
}

/**
 * Saves the reservation by clicking the submit button.
 */
export async function saveReservation(page: Page): Promise<void> {
  const saveButton = page.locator('button:has-text("Zapisz"), button:has-text("Dodaj"), button[type="submit"]');
  await saveButton.first().click();
}

/**
 * Waits for success toast message.
 */
export async function waitForSuccessToast(page: Page): Promise<void> {
  await page.waitForSelector('[data-sonner-toast][data-type="success"], .toast-success, [role="status"]:has-text("Rezerwacja")', {
    timeout: 10000,
  });
}

/**
 * Verifies that a reservation with given customer name appears on the calendar.
 */
export async function verifyReservationOnCalendar(page: Page, customerName: string): Promise<boolean> {
  // Wait for calendar to update
  await page.waitForTimeout(1000);
  
  // Look for reservation card/block with customer name
  const reservation = page.locator(`[data-testid="reservation-card"]:has-text("${customerName}"), .reservation-block:has-text("${customerName}"), [class*="reservation"]:has-text("${customerName}")`);
  
  return await reservation.first().isVisible({ timeout: 5000 }).catch(() => false);
}

/**
 * Clicks on a reservation on the calendar to open details drawer.
 */
export async function openReservationDetails(page: Page, customerName: string): Promise<void> {
  const reservation = page.locator(`[data-testid="reservation-card"]:has-text("${customerName}"), .reservation-block:has-text("${customerName}"), [class*="reservation"]:has-text("${customerName}")`);
  await reservation.first().click();
  
  // Wait for drawer to open
  await page.waitForSelector('[data-testid="reservation-details-drawer"], [role="dialog"]:has-text("Rezerwacja")', {
    timeout: 5000,
  });
}

/**
 * Verifies that reservation details drawer shows correct data.
 */
export async function verifyReservationDetails(
  page: Page,
  expected: {
    customerName?: string;
    phone?: string;
    carModel?: string;
    plate?: string;
  }
): Promise<{ matches: boolean; found: Record<string, string> }> {
  const found: Record<string, string> = {};
  
  const drawerContent = page.locator('[data-testid="reservation-details-drawer"], [role="dialog"]');
  const text = await drawerContent.textContent() || '';
  
  if (expected.customerName) {
    found.customerName = text.includes(expected.customerName) ? expected.customerName : '';
  }
  if (expected.phone) {
    found.phone = text.includes(expected.phone) ? expected.phone : '';
  }
  if (expected.carModel) {
    found.carModel = text.includes(expected.carModel) ? expected.carModel : '';
  }
  if (expected.plate) {
    found.plate = text.includes(expected.plate) ? expected.plate : '';
  }
  
  const matches = Object.entries(expected).every(([key, val]) => {
    if (!val) return true;
    return found[key] === val;
  });
  
  return { matches, found };
}

/**
 * Clicks edit button in reservation details drawer.
 */
export async function clickEditReservation(page: Page): Promise<void> {
  const editButton = page.locator('[data-testid="edit-reservation-btn"], button:has-text("Edytuj"), button:has(.lucide-pencil)');
  await editButton.first().click();
  
  // Wait for edit dialog/drawer to open
  await page.waitForSelector('[data-testid="reservation-dialog"], [role="dialog"]:has(input)', {
    timeout: 5000,
  });
}

/**
 * Closes reservation details drawer.
 */
export async function closeReservationDetails(page: Page): Promise<void> {
  // Try close button first, then escape key
  const closeButton = page.locator('[data-testid="close-drawer"], button[aria-label="Close"], .drawer-close');
  if (await closeButton.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.first().click();
  } else {
    await page.keyboard.press('Escape');
  }
  
  // Wait for drawer to close
  await page.waitForSelector('[data-testid="reservation-details-drawer"]', { 
    state: 'hidden',
    timeout: 3000 
  }).catch(() => {});
}

/**
 * Changes reservation status via drawer action buttons.
 */
export async function changeReservationStatus(
  page: Page, 
  action: 'start' | 'complete' | 'cancel' | 'confirm'
): Promise<void> {
  const actionMap = {
    start: ['Rozpocznij', 'Start'],
    complete: ['Zakończ', 'Gotowe', 'Wydaj'],
    cancel: ['Anuluj', 'Cancel'],
    confirm: ['Potwierdź', 'Confirm'],
  };
  
  const buttonTexts = actionMap[action];
  for (const text of buttonTexts) {
    const button = page.locator(`button:has-text("${text}")`);
    if (await button.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.first().click();
      await page.waitForTimeout(500);
      return;
    }
  }
  
  throw new Error(`Could not find button for action: ${action}`);
}

/**
 * Updates reservation form field.
 */
export async function updateReservationField(
  page: Page,
  field: 'phone' | 'name' | 'carModel' | 'plate' | 'adminNotes',
  value: string
): Promise<void> {
  const fieldSelectors = {
    phone: 'input[name="phone"], [data-testid="phone-input"]',
    name: 'input[name="name"], [data-testid="name-input"]',
    carModel: 'input[name="model"], [data-testid="car-input"]',
    plate: 'input[name="plate"], [data-testid="plate-input"]',
    adminNotes: 'textarea[name="adminNotes"], [data-testid="admin-notes"]',
  };
  
  const input = page.locator(fieldSelectors[field]);
  await input.first().clear();
  await input.first().fill(value);
}

/**
 * Drags a reservation card to a new time slot on the calendar.
 * Returns the target time as string if successful.
 */
export async function dragReservationToTime(
  page: Page,
  customerName: string,
  targetTime: string,
  targetStationIndex: number = 0
): Promise<void> {
  // Find the reservation card
  const reservationCard = page.locator(
    `[data-testid="reservation-card"]:has-text("${customerName}"), .reservation-block:has-text("${customerName}"), [class*="reservation"]:has-text("${customerName}")`
  ).first();
  
  // Ensure it's visible
  await reservationCard.waitFor({ state: 'visible', timeout: 5000 });
  
  // Find target time slot
  // Time slots have data-time attribute or contain the time text
  const targetSlot = page.locator(
    `[data-time="${targetTime}"], [data-testid="time-slot-${targetTime}"]`
  ).nth(targetStationIndex);
  
  // If no exact selector, try finding by time pattern in grid
  if (!(await targetSlot.isVisible({ timeout: 1000 }).catch(() => false))) {
    // Alternative: find by position in time column
    const timeSlots = page.locator('[data-testid="calendar-slot"], .calendar-slot, [class*="slot"]');
    const allSlots = await timeSlots.all();
    
    for (const slot of allSlots) {
      const slotTime = await slot.getAttribute('data-time');
      if (slotTime === targetTime) {
        await reservationCard.dragTo(slot);
        return;
      }
    }
  }
  
  // Perform drag and drop
  await reservationCard.dragTo(targetSlot);
}

/**
 * Gets the current time displayed on a reservation card.
 */
export async function getReservationTime(page: Page, customerName: string): Promise<string> {
  const reservationCard = page.locator(
    `[data-testid="reservation-card"]:has-text("${customerName}"), .reservation-block:has-text("${customerName}"), [class*="reservation"]:has-text("${customerName}")`
  ).first();
  
  const text = await reservationCard.textContent() || '';
  
  // Extract time pattern (e.g., "10:00 - 11:30" or "10:00-11:30")
  const timeMatch = text.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1]} - ${timeMatch[2]}`;
  }
  
  return '';
}

/**
 * Opens the time picker in the reservation edit dialog and changes start time.
 */
export async function changeReservationStartTime(
  page: Page,
  newStartTime: string
): Promise<void> {
  // Find start time selector/dropdown
  const startTimeSelect = page.locator(
    '[data-testid="start-time-select"], select[name="startTime"], [aria-label*="Godzina rozpoczęcia"], button:has-text("Rozpoczęcie")'
  ).first();
  
  // Click to open dropdown
  await startTimeSelect.click();
  
  // Wait for options to appear
  await page.waitForTimeout(300);
  
  // Select the new time
  const timeOption = page.locator(`[role="option"]:has-text("${newStartTime}"), [data-value="${newStartTime}"]`);
  if (await timeOption.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeOption.first().click();
  } else {
    // Try clicking on dropdown item directly
    await page.click(`text="${newStartTime}"`);
  }
}

/**
 * Opens the time picker in the reservation edit dialog and changes end time.
 */
export async function changeReservationEndTime(
  page: Page,
  newEndTime: string
): Promise<void> {
  // Find end time selector/dropdown
  const endTimeSelect = page.locator(
    '[data-testid="end-time-select"], select[name="endTime"], [aria-label*="Godzina zakończenia"], button:has-text("Zakończenie")'
  ).first();
  
  // Click to open dropdown
  await endTimeSelect.click();
  
  // Wait for options to appear
  await page.waitForTimeout(300);
  
  // Select the new time
  const timeOption = page.locator(`[role="option"]:has-text("${newEndTime}"), [data-value="${newEndTime}"]`);
  if (await timeOption.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeOption.first().click();
  } else {
    await page.click(`text="${newEndTime}"`);
  }
}

/**
 * Verifies the time displayed in the reservation details drawer.
 */
export async function verifyReservationTimeInDrawer(
  page: Page,
  expectedStartTime: string,
  expectedEndTime: string
): Promise<boolean> {
  const drawer = page.locator('[data-testid="reservation-details-drawer"], [role="dialog"]');
  const text = await drawer.textContent() || '';
  
  // Check if both times are present
  const hasStartTime = text.includes(expectedStartTime);
  const hasEndTime = text.includes(expectedEndTime);
  
  return hasStartTime && hasEndTime;
}
