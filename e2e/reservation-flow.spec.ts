import { test, expect } from '@playwright/test';
import {
  seedE2EReset,
  seedE2EScenario,
  loginAsAdmin,
  openAddReservationDialog,
  fillReservationForm,
  selectFirstService,
  saveReservation,
  waitForSuccessToast,
  verifyReservationOnCalendar,
  E2E_CONFIG,
} from './fixtures/e2e-helpers';

test.describe('Reservation Flow', () => {
  test.beforeEach(async () => {
    // Reset E2E instance data before each test
    console.log('🧹 Resetting E2E instance...');
    const resetResult = await seedE2EReset();
    console.log('Reset result:', resetResult);

    // Seed basic scenario (stations, services)
    console.log('🌱 Seeding basic scenario...');
    const seedResult = await seedE2EScenario('basic');
    console.log('Seed result:', seedResult);
  });

  test('RF-E2E-001: Admin dodaje rezerwację i widzi ją na kalendarzu', async ({ page }) => {
    // Test data
    const testCustomer = {
      phone: '111222333',
      name: 'Test E2E',
      carModel: 'BMW X5',
      plate: 'WE E2E01',
    };

    // Step 1: Login as admin
    console.log('🔐 Logging in as admin...');
    await loginAsAdmin(page);
    
    // Verify we're on admin dashboard
    await expect(page).toHaveURL(new RegExp(`/${E2E_CONFIG.instanceSlug}`));
    console.log('✅ Logged in successfully');

    // Step 2: Open Add Reservation dialog
    console.log('📝 Opening add reservation dialog...');
    await openAddReservationDialog(page);
    console.log('✅ Dialog opened');

    // Step 3: Fill reservation form
    console.log('✍️ Filling reservation form...');
    await fillReservationForm(page, testCustomer);
    console.log('✅ Form filled');

    // Step 4: Select first available service
    console.log('🔧 Selecting service...');
    await selectFirstService(page);
    console.log('✅ Service selected');

    // Step 5: Save reservation
    console.log('💾 Saving reservation...');
    await saveReservation(page);

    // Step 6: Verify success toast
    console.log('🔔 Waiting for success toast...');
    await waitForSuccessToast(page);
    console.log('✅ Success toast appeared');

    // Step 7: Verify reservation appears on calendar
    console.log('📅 Verifying reservation on calendar...');
    const isVisible = await verifyReservationOnCalendar(page, testCustomer.name);
    expect(isVisible).toBe(true);
    console.log('✅ Reservation visible on calendar');
  });

  test('RF-E2E-002: Admin widzi rezerwacje z seed-a', async ({ page }) => {
    // Seed with reservations instead of basic
    console.log('🌱 Seeding with_reservations scenario...');
    await seedE2EReset();
    await seedE2EScenario('with_reservations');

    // Login
    await loginAsAdmin(page);

    // Wait for calendar to load
    await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
      timeout: 10000,
    });

    // Verify at least one reservation is visible
    const reservations = page.locator('[data-testid="reservation-card"], .reservation-block, [class*="reservation"]');
    const count = await reservations.count();
    
    console.log(`📊 Found ${count} reservations on calendar`);
    expect(count).toBeGreaterThan(0);
  });
});
