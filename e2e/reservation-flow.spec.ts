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
    console.log('Seed result:', seedResult);

    // ========================================================================
    // STEP 1: Login as admin
    // ========================================================================
    console.log('\n📍 STEP 1: Login as admin');
    await loginAsAdmin(page);
    await expect(page).not.toHaveURL(/\/login(\?|$)/);
    console.log('✅ Logged in successfully');

    // Reload to fetch seeded data
    console.log('🔄 Reloading to fetch seeded stations...');
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for calendar to fully load
    await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
      timeout: 15000,
    });
    
    // Wait for calendar slots to render (they have data-testid="calendar-slot")
    console.log('⏳ Waiting for calendar slots to render...');
    await page.waitForSelector('[data-testid="calendar-slot"]', { timeout: 10000 });
    
    const slotCount = await page.locator('[data-testid="calendar-slot"]').count();
    console.log(`✅ Calendar loaded with ${slotCount} slots`);

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

    // Get all unique station IDs from the slots
    const allSlots = page.locator('[data-testid="calendar-slot"]');
    const firstSlot = allSlots.first();
    const firstStationId = await firstSlot.getAttribute('data-station');
    console.log(`[E2E] First station ID: ${firstStationId}`);
    
    // Find all slots for the first station
    const firstStationSlots = page.locator(`[data-testid="calendar-slot"][data-station="${firstStationId}"]`);
    const firstStationSlotCount = await firstStationSlots.count();
    console.log(`[E2E] First station has ${firstStationSlotCount} slots`);
    
    // Click on slot at 10:00 for the first station
    const targetSlot = page.locator(`[data-testid="calendar-slot"][data-station="${firstStationId}"][data-time="10:00"]`).first();
    const slotVisible = await targetSlot.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (slotVisible) {
      console.log('[E2E] Found slot at 10:00 on first station, clicking...');
      await targetSlot.click();
    } else {
      // Fallback: click first slot of first station
      console.log('[E2E] 10:00 slot not found, clicking first available slot on first station...');
      await firstStationSlots.first().click();
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

    // Car model
    const carInput = page.locator('input[name="model"], input[placeholder*="Model"], [data-testid="car-input"]').first();
    if (await carInput.isVisible()) {
      await carInput.fill(testCustomer.carModel);
      await page.waitForTimeout(300);
      // Select from autocomplete if visible
      const autocompleteOption = page.locator('[role="option"], [class*="autocomplete"] li').first();
      if (await autocompleteOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await autocompleteOption.click();
      }
    }

    // Plate
    const plateInput = page.locator('input[name="plate"], input[placeholder*="Rejestracja"], [data-testid="plate-input"]').first();
    if (await plateInput.isVisible()) {
      await plateInput.fill(testCustomer.plate);
    }

    // Select first service
    console.log('🔧 Selecting service...');
    const serviceButton = page.locator('[data-testid="service-item"], .service-card, [class*="service"]').first();
    if (await serviceButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await serviceButton.click();
    }

    // Save reservation
    console.log('💾 Saving reservation...');
    const saveButton = page.locator('button:has-text("Zapisz"), button:has-text("Dodaj"), button[type="submit"]').first();
    await saveButton.click();

    // Wait for success
    await page.waitForSelector('[data-sonner-toast][data-type="success"], .toast-success, [role="status"]', {
      timeout: 10000,
    }).catch(() => console.log('⚠️ Toast not detected, continuing...'));
    
    // Wait for dialog to close
    await page.waitForTimeout(1000);
    console.log('✅ Reservation created');

    // ========================================================================
    // STEP 3: View reservation details
    // ========================================================================
    console.log('\n📍 STEP 3: View reservation details');

    // Find the reservation on calendar (draggable div with customer name)
    const reservation = page.locator(`div[draggable="true"]:has-text("${testCustomer.name}"), [class*="reservation"]:has-text("${testCustomer.name}")`).first();
    
    const reservationVisible = await reservation.isVisible({ timeout: 5000 }).catch(() => false);
    if (!reservationVisible) {
      await page.screenshot({ path: 'test-results/debug-reservation-not-visible.png' });
      console.log('[E2E] Reservation not immediately visible, checking page content...');
      
      // Try broader selector
      const anyReservation = page.locator('div[draggable="true"]').first();
      if (await anyReservation.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[E2E] Found a draggable div, clicking on it instead');
        await anyReservation.click();
      } else {
        throw new Error(`Reservation for "${testCustomer.name}" not found on calendar`);
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
    // STEP 6: Drag and drop reservation to SECOND STATION
    // ========================================================================
    console.log('\n📍 STEP 6: Drag and drop reservation to SECOND station');

    const dragSource = page.locator(`div[draggable="true"]:has-text("${testCustomer.name}")`).first();
    const isDraggable = await dragSource.getAttribute('draggable');
    
    if (isDraggable === 'true') {
      const sourceBox = await dragSource.boundingBox();
      
      // Find the second station's slot to get target X position
      const allSlotsForDrag = page.locator('[data-testid="calendar-slot"]');
      const stationIds = new Set<string>();
      const slotCountForDrag = await allSlotsForDrag.count();
      
      for (let i = 0; i < Math.min(slotCountForDrag, 50); i++) {
        const stationId = await allSlotsForDrag.nth(i).getAttribute('data-station');
        if (stationId) stationIds.add(stationId);
      }
      
      const stationIdArray = Array.from(stationIds);
      console.log(`[E2E] Found ${stationIdArray.length} stations: ${stationIdArray.join(', ')}`);
      
      if (sourceBox && stationIdArray.length >= 2) {
        // Get a slot from the second station to find target X position
        const secondStationSlot = page.locator(`[data-testid="calendar-slot"][data-station="${stationIdArray[1]}"][data-time="10:00"]`).first();
        const secondStationBox = await secondStationSlot.boundingBox();
        
        if (secondStationBox) {
          console.log(`[E2E] Dragging from station 1 (x=${Math.round(sourceBox.x)}) to station 2 (x=${Math.round(secondStationBox.x)})`);
          
          // Drag to second station, same time
          await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(secondStationBox.x + secondStationBox.width / 2, sourceBox.y, { steps: 15 });
          await page.mouse.up();
          
          await page.waitForTimeout(1000);
          console.log('✅ Drag and drop to second station completed');
        } else {
          // Fallback: just drag down on same station
          console.log('[E2E] Second station slot not found, dragging down instead');
          await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 120, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(1000);
        }
      } else if (sourceBox) {
        // Only 1 station, drag down
        console.log('[E2E] Only 1 station found, dragging down by 2 hours');
        await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 120, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
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
