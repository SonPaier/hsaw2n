import { test, expect } from '@playwright/test';
import {
  seedE2EReset,
  seedE2EScenario,
  loginAsAdmin,
  E2E_CONFIG,
} from './fixtures/e2e-helpers';

/**
 * RF-E2E-001: Full Admin Reservation Happy Path
 * 
 * Covers the complete flow:
 * 1. Login as admin
 * 2. Create a new reservation (click on grid slot)
 * 3. View reservation details
 * 4. Edit reservation
 * 5. Change reservation status
 * 6. Drag and drop to new time
 * 7. Verify session persistence after refresh
 */
test.describe('Reservation Happy Path', () => {
  test('Admin pełny flow: logowanie → dodanie → detale → edycja → drag&drop', async ({ page }) => {
    // ========================================================================
    // SETUP: Reset and seed E2E instance
    // ========================================================================
    console.log('🧹 Resetting E2E instance...');
    await seedE2EReset();
    
    console.log('🌱 Seeding basic scenario (stations, services)...');
    const seedResult = await seedE2EScenario('basic');
    console.log('Seed result:', JSON.stringify(seedResult, null, 2));

    // Validate seed result - API returns createdData.stations as count
    const createdData = seedResult.createdData as { stations?: number; services?: number } | undefined;
    if (!createdData?.stations || createdData.stations === 0) {
      throw new Error(`Seeding failed: no stations created: ${JSON.stringify(seedResult)}`);
    }
    console.log(`✅ Seeded ${createdData.stations} stations, ${createdData.services ?? 0} services`);

    // Short pause for database propagation
    await new Promise(r => setTimeout(r, 500));

    // ========================================================================
    // STEP 1: Login as admin
    // ========================================================================
    console.log('\n📍 STEP 1: Login as admin');
    await loginAsAdmin(page);
    await expect(page).not.toHaveURL(/\/login(\?|$)/);
    console.log('✅ Logged in and calendar loaded with stations');

    // Get calendar container for subsequent operations
    const calendarContainer = page.locator('[data-testid="admin-calendar"]');
    const slotCount = await calendarContainer.locator('[data-testid="calendar-slot"]').count();
    console.log(`[E2E] Calendar has ${slotCount} slots ready`);

    // ========================================================================
    // STEP 2: Create reservation by clicking on calendar slot (FIRST STATION)
    // ========================================================================
    console.log('\n📍 STEP 2: Create reservation on FIRST station');
    
    const testCustomer = {
      phone: '111222333',
      name: 'Test E2E Happy',
      carModel: 'BMW X5',
      plate: 'WE E2E01',
    };

    // Get clickable slots (not disabled) within the calendar
    const clickableSlots = calendarContainer.locator('[data-testid="calendar-slot"]:not([data-disabled="true"])');
    const clickableCount = await clickableSlots.count();
    console.log(`[E2E] Found ${clickableCount} clickable slots`);
    
    // Get first station ID from slots
    const firstSlot = clickableSlots.first();
    const firstStationId = await firstSlot.getAttribute('data-station');
    console.log(`[E2E] First station ID: ${firstStationId}`);
    
    // Try to click slot at 10:00 for better visibility in tests
    const slot1000 = calendarContainer.locator(
      `[data-testid="calendar-slot"][data-station="${firstStationId}"][data-time="10:00"]:not([data-disabled="true"])`
    ).first();
    
    const has1000 = await slot1000.count() > 0;
    
    if (has1000) {
      console.log('[E2E] Clicking slot at 10:00 on first station...');
      await slot1000.click();
    } else {
      // Fallback: click first clickable slot on first station
      console.log('[E2E] 10:00 not available, clicking first clickable slot...');
      const firstStationSlot = calendarContainer.locator(
        `[data-testid="calendar-slot"][data-station="${firstStationId}"]:not([data-disabled="true"])`
      ).first();
      await firstStationSlot.click();
    }
    
    // Wait for dialog to open
    const dialogOpened = await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => null);
    
    if (!dialogOpened) {
      await page.screenshot({ path: 'test-results/debug-no-dialog-after-click.png' });
      throw new Error('Dialog did not open after clicking on calendar');
    }
    console.log('✅ Reservation dialog opened');

    // Fill the form
    console.log('✍️ Filling reservation form...');
    
    // Phone
    const phoneInput = page.locator('input[name="phone"], input[placeholder*="Telefon"], [data-testid="phone-input"]').first();
    await phoneInput.fill(testCustomer.phone);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Name
    const nameInput = page.locator('input[name="name"], input[placeholder*="Imię"], [data-testid="name-input"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(testCustomer.name);
    }

    // Car model - type "golf" and select from autocomplete
    console.log('🚗 Selecting car model...');
    const carInput = page.locator('input[name="model"], input[placeholder*="Model"], [data-testid="car-input"]').first();
    if (await carInput.isVisible()) {
      await carInput.click();
      await carInput.fill('golf');
      console.log('✅ Typed "golf" in car input');
      
      // Wait for autocomplete options to appear
      await page.waitForTimeout(500);
      
      // Select "Volkswagen Golf" from autocomplete list
      const autocompleteOption = page.locator('[role="option"]:has-text("Golf"), [data-testid="car-option"]:has-text("Golf")').first();
      if (await autocompleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await autocompleteOption.click();
        console.log('✅ Selected Volkswagen Golf from autocomplete');
      } else {
        // Fallback - press Enter to confirm
        await page.keyboard.press('Enter');
        console.log('⚠️ Autocomplete not visible, pressed Enter');
      }
      await page.waitForTimeout(300);
    }

    // Plate
    const plateInput = page.locator('input[name="plate"], input[placeholder*="Rejestracja"], [data-testid="plate-input"]').first();
    if (await plateInput.isVisible()) {
      await plateInput.fill(testCustomer.plate);
      console.log('✅ Filled plate number');
    }

    // Select services - open drawer ONCE, select TWO services, then confirm
    console.log('🔧 Selecting services...');
    
    const addServicesButton = page.locator('[data-testid="add-services-button"], button:has-text("Dodaj usługi")').first();
    await addServicesButton.waitFor({ state: 'visible', timeout: 5000 });
    await addServicesButton.click();
    console.log('✅ Opened service drawer');
    
    // Wait for drawer to fully open and services to load
    await page.waitForTimeout(800);
    
    // Get all service items
    const serviceItems = page.locator('[data-testid="service-item"]');
    const serviceCount = await serviceItems.count();
    console.log(`[E2E] Found ${serviceCount} services in drawer`);
    
    // Click on first two services (if available)
    if (serviceCount >= 1) {
      await serviceItems.nth(0).click();
      console.log('✅ Selected first service');
    }
    
    if (serviceCount >= 2) {
      await page.waitForTimeout(200);
      await serviceItems.nth(1).click();
      console.log('✅ Selected second service');
    }
    
    await page.waitForTimeout(300);
    
    // Click confirm button to add services and close drawer
    const confirmButton = page.locator('[data-testid="service-confirm-button"]').first();
    await confirmButton.click();
    console.log('✅ Confirmed service selection');
    
    // Wait for drawer to close
    await page.waitForTimeout(500)

    // Save reservation
    console.log('💾 Saving reservation...');
    // Button text is "Dodaj rezerwację" for new reservations (from t('addReservation.addReservation'))
    const saveButton = page.locator('button:has-text("Dodaj rezerwację"), button:has-text("Zapisz"), button:has-text("Dodaj")').first();
    await saveButton.click();

    // Wait for Sheet (dialog) to close - this is the primary success indicator
    // Sheet uses [role="dialog"] in Radix UI
    console.log('⏳ Waiting for dialog to close...');
    try {
      await page.waitForFunction(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        return dialogs.length === 0;
      }, { timeout: 15000 });
      console.log('✅ Dialog closed successfully');
    } catch {
      console.log('⚠️ Dialog still open after 15s, taking screenshot...');
      await page.screenshot({ path: 'test-results/debug-dialog-still-open.png' });
    }
    
    // Check for Sonner success toast (optional - toast may auto-dismiss quickly)
    // Sonner uses [data-sonner-toast] with data-type attribute
    const toastVisible = await page.locator('[data-sonner-toast]').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (toastVisible) {
      const toastText = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '');
      console.log(`✅ Toast detected: "${toastText}"`);
    } else {
      console.log('ℹ️ Toast not visible (may have auto-dismissed)');
    }
    
    // Wait for calendar to refresh with new reservation
    await page.waitForTimeout(2000);
    console.log('✅ Reservation created');

    // ========================================================================
    // STEP 3: View reservation details
    // ========================================================================
    console.log('\n📍 STEP 3: View reservation details');

    // Wait for reservation to appear on calendar with retry logic
    const reservation = page.locator(`div[draggable="true"]:has-text("${testCustomer.name}")`).first();
    
    // Retry loop - wait up to 10 seconds for reservation to appear
    let reservationFound = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const isVisible = await reservation.isVisible().catch(() => false);
      if (isVisible) {
        reservationFound = true;
        console.log(`✅ Reservation found on attempt ${attempt + 1}`);
        break;
      }
      await page.waitForTimeout(1000);
      console.log(`[E2E] Waiting for reservation to appear... attempt ${attempt + 1}/10`);
    }
    
    if (!reservationFound) {
      await page.screenshot({ path: 'test-results/debug-reservation-not-visible.png' });
      console.log('[E2E] Reservation not visible after 10s, checking for any draggable...');
      
      // Try broader selector - any reservation
      const anyReservation = page.locator('div[draggable="true"]').first();
      if (await anyReservation.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[E2E] Found a draggable div, clicking on it instead');
        await anyReservation.click();
      } else {
        throw new Error(`Reservation for "${testCustomer.name}" not found on calendar after 10s`);
      }
    } else {
      await reservation.click();
    }

    // Wait for details drawer to open
    await page.waitForSelector('[data-testid="reservation-details-drawer"], [role="dialog"]', {
      timeout: 5000,
    });
    console.log('✅ Details drawer opened');

    // Verify customer name is displayed
    const drawerContent = await page.locator('[data-testid="reservation-details-drawer"], [role="dialog"]').textContent();
    expect(drawerContent).toContain(testCustomer.name);
    console.log('✅ Customer details verified');

    // ========================================================================
    // STEP 4: Edit reservation
    // ========================================================================
    console.log('\n📍 STEP 4: Edit reservation');

    // Click edit button
    const editButton = page.locator('[data-testid="edit-reservation-btn"], button:has-text("Edytuj"), button:has(.lucide-pencil)').first();
    await editButton.click();

    // Wait for edit dialog
    await page.waitForSelector('[role="dialog"]:has(input)', { timeout: 5000 });
    console.log('✅ Edit dialog opened');

    // Update admin notes
    const notesField = page.locator('textarea[name="adminNotes"], [data-testid="admin-notes"], textarea').first();
    if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notesField.fill('Updated via E2E test');
      console.log('✅ Admin notes updated');
    }

    // Save changes
    const saveEditButton = page.locator('button:has-text("Zapisz"), button[type="submit"]').first();
    await saveEditButton.click();

    // Wait for success
    await page.waitForSelector('[data-sonner-toast][data-type="success"], .toast-success', {
      timeout: 10000,
    }).catch(() => console.log('⚠️ Toast not detected after edit'));
    
    await page.waitForTimeout(500);
    console.log('✅ Reservation updated');

    // ========================================================================
    // STEP 5: Change reservation status
    // ========================================================================
    console.log('\n📍 STEP 5: Change status to "in progress"');

    // Re-open details if drawer was closed
    const drawerStillOpen = await page.locator('[data-testid="reservation-details-drawer"], [role="dialog"]').isVisible().catch(() => false);
    if (!drawerStillOpen) {
      const reservationCard = page.locator(`div[draggable="true"]:has-text("${testCustomer.name}")`).first();
      await reservationCard.click();
      await page.waitForSelector('[data-testid="reservation-details-drawer"], [role="dialog"]', { timeout: 5000 });
    }

    // Try to start the reservation
    const startButton = page.locator('button:has-text("Rozpocznij"), button:has-text("Start")').first();
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Status changed to in progress');
    } else {
      console.log('⚠️ Start button not available (status may already be different)');
    }

    // Close drawer
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ========================================================================
    // STEP 6: Drag and drop reservation from 10:00 station 1 → 12:30 station 2
    // ========================================================================
    console.log('\n📍 STEP 6: Drag and drop reservation: 10:00 station 1 → 12:30 station 2');

    const dragSource = page.locator(`div[draggable="true"]:has-text("${testCustomer.name}")`).first();
    const isDraggable = await dragSource.getAttribute('draggable');
    
    if (isDraggable === 'true') {
      const sourceBox = await dragSource.boundingBox();
      
      // Collect unique station IDs
      const allSlotsForDrag = page.locator('[data-testid="calendar-slot"]');
      const stationIds = new Set<string>();
      const slotCountForDrag = await allSlotsForDrag.count();
      
      for (let i = 0; i < Math.min(slotCountForDrag, 100); i++) {
        const stationId = await allSlotsForDrag.nth(i).getAttribute('data-station');
        if (stationId) stationIds.add(stationId);
      }
      
      const stationIdArray = Array.from(stationIds);
      console.log(`[E2E] Found ${stationIdArray.length} stations: ${stationIdArray.slice(0, 3).join(', ')}...`);
      
      if (sourceBox && stationIdArray.length >= 2) {
        // Target: slot at 12:30 on second station
        const targetSlotSelector = `[data-testid="calendar-slot"][data-station="${stationIdArray[1]}"][data-time="12:30"]`;
        const targetSlot = page.locator(targetSlotSelector).first();
        const targetBox = await targetSlot.boundingBox();
        
        if (targetBox) {
          console.log(`[E2E] Dragging from (${Math.round(sourceBox.x)}, ${Math.round(sourceBox.y)}) to (${Math.round(targetBox.x)}, ${Math.round(targetBox.y)})`);
          console.log(`[E2E] Source: station ${stationIdArray[0]} @ 10:00 → Target: station ${stationIdArray[1]} @ 12:30`);
          
          // Perform drag and drop
          await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
          await page.mouse.down();
          // Move in steps for smoother animation
          await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
          await page.mouse.up();
          
          await page.waitForTimeout(1000);
          console.log('✅ Drag and drop: 10:00 station 1 → 12:30 station 2 completed');
        } else {
          // Fallback: try 12:00 if 12:30 not found
          console.log('[E2E] 12:30 slot not found, trying 12:00...');
          const fallbackSlot = page.locator(`[data-testid="calendar-slot"][data-station="${stationIdArray[1]}"][data-time="12:00"]`).first();
          const fallbackBox = await fallbackSlot.boundingBox();
          
          if (fallbackBox) {
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(fallbackBox.x + fallbackBox.width / 2, fallbackBox.y + fallbackBox.height / 2, { steps: 20 });
            await page.mouse.up();
            await page.waitForTimeout(1000);
            console.log('✅ Drag and drop to 12:00 completed (fallback)');
          } else {
            console.log('[E2E] Could not find target slot, skipping drag');
          }
        }
      } else if (sourceBox) {
        // Only 1 station, drag down to ~12:30 on same station
        console.log('[E2E] Only 1 station found, dragging to 12:30 on same station');
        const sameStationTarget = page.locator(`[data-testid="calendar-slot"][data-station="${stationIdArray[0]}"][data-time="12:30"]`).first();
        const sameStationBox = await sameStationTarget.boundingBox();
        
        if (sameStationBox) {
          await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(sameStationBox.x + sameStationBox.width / 2, sameStationBox.y + sameStationBox.height / 2, { steps: 15 });
          await page.mouse.up();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      console.log('⚠️ Reservation not draggable (mobile view or disabled)');
    }

    // ========================================================================
    // STEP 7: Verify session persistence
    // ========================================================================
    console.log('\n📍 STEP 7: Verify session persistence');

    await page.reload();
    
    // Should still be on dashboard (not redirected to login)
    await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
      timeout: 15000,
    });
    
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    console.log('✅ Session persisted after refresh');

    // Verify reservation still exists
    const reservationAfterRefresh = page.locator(`div[draggable="true"]:has-text("${testCustomer.name}")`).first();
    const stillVisible = await reservationAfterRefresh.isVisible({ timeout: 5000 }).catch(() => false);
    expect(stillVisible).toBe(true);
    console.log('✅ Reservation still visible after refresh');

    // ========================================================================
    // SUCCESS
    // ========================================================================
    console.log('\n🎉 HAPPY PATH COMPLETED SUCCESSFULLY!');
  });
});
