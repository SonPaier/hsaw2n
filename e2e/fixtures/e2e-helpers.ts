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
 * Logs in as admin to the E2E instance.
 * Navigates to login page, fills credentials, and waits for dashboard.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  // Navigate to E2E instance login
  await page.goto(`/${E2E_CONFIG.instanceSlug}/login`);
  
  // Wait for login form
  await page.waitForSelector('input[name="username"], input[placeholder*="Login"]', { timeout: 10000 });
  
  // Fill credentials (username-based login)
  await page.fill('input[name="username"], input[placeholder*="Login"]', E2E_ADMIN.username);
  await page.fill('input[type="password"], input[name="password"]', E2E_ADMIN.password);
  
  // Submit login
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load (calendar view)
  await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', { 
    timeout: 15000 
  });
}

/**
 * Opens the "Add Reservation" dialog.
 */
export async function openAddReservationDialog(page: Page): Promise<void> {
  // Look for "Dodaj rezerwację" button or similar
  const addButton = page.locator('button:has-text("Dodaj rezerwację"), button:has-text("Nowa rezerwacja"), [data-testid="add-reservation-btn"]');
  await addButton.first().click();
  
  // Wait for dialog to open
  await page.waitForSelector('[role="dialog"], [data-testid="reservation-dialog"]', { timeout: 5000 });
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
