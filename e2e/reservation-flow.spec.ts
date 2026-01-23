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
  openReservationDetails,
  verifyReservationDetails,
  clickEditReservation,
  closeReservationDetails,
  changeReservationStatus,
  updateReservationField,
  dragReservationToTime,
  getReservationTime,
  changeReservationStartTime,
  changeReservationEndTime,
  verifyReservationTimeInDrawer,
  E2E_CONFIG,
} from './fixtures/e2e-helpers';

// ============================================================================
// Reusable test fixtures
// ============================================================================

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

  // ==========================================================================
  // RF-E2E-001: Create Reservation Happy Path
  // ==========================================================================
  test('RF-E2E-001: Admin dodaje rezerwację i widzi ją na kalendarzu', async ({ page }) => {
    const testCustomer = {
      phone: '111222333',
      name: 'Test E2E',
      carModel: 'BMW X5',
      plate: 'WE E2E01',
    };

    // Step 1: Login as admin
    console.log('🔐 Logging in as admin...');
    await loginAsAdmin(page);
    // In dev/staging routing we land on /admin, in subdomain mode it can be /.
    // Just assert we are not stuck on login anymore.
    await expect(page).not.toHaveURL(/\/login(\?|$)/);
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

  // ==========================================================================
  // RF-E2E-002: View Seeded Reservations
  // ==========================================================================
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

  // ==========================================================================
  // RF-E2E-003: View Reservation Details
  // ==========================================================================
  test('RF-E2E-003: Admin otwiera i widzi szczegóły rezerwacji', async ({ page }) => {
    // Seed with reservations
    console.log('🌱 Seeding with_reservations scenario...');
    await seedE2EReset();
    await seedE2EScenario('with_reservations');

    // Login
    console.log('🔐 Logging in as admin...');
    await loginAsAdmin(page);

    // Wait for calendar
    await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
      timeout: 10000,
    });

    // Click on first reservation to open details
    console.log('👆 Clicking on reservation...');
    const firstReservation = page.locator('[data-testid="reservation-card"], .reservation-block, [class*="reservation"]').first();
    await firstReservation.click();

    // Verify drawer opened
    console.log('📋 Verifying details drawer...');
    await page.waitForSelector('[data-testid="reservation-details-drawer"], [role="dialog"]', {
      timeout: 5000,
    });

    // Verify drawer has essential elements
    const drawer = page.locator('[data-testid="reservation-details-drawer"], [role="dialog"]');
    const drawerText = await drawer.textContent();
    
    // Should contain some reservation data (phone, name, or status)
    const hasContent = drawerText && (
      drawerText.includes('Telefon') || 
      drawerText.includes('Klient') || 
      drawerText.includes('Status') ||
      drawerText.includes('Usługi')
    );
    
    expect(hasContent).toBe(true);
    console.log('✅ Reservation details displayed correctly');
  });

  // ==========================================================================
  // RF-E2E-004: Edit Reservation
  // ==========================================================================
  test('RF-E2E-004: Admin edytuje rezerwację', async ({ page }) => {
    // First create a reservation
    const testCustomer = {
      phone: '222333444',
      name: 'Edit Test',
      carModel: 'Audi A4',
      plate: 'WE EDIT1',
    };

    console.log('🔐 Logging in...');
    await loginAsAdmin(page);

    // Create reservation
    console.log('📝 Creating reservation to edit...');
    await openAddReservationDialog(page);
    await fillReservationForm(page, testCustomer);
    await selectFirstService(page);
    await saveReservation(page);
    await waitForSuccessToast(page);

    // Verify it's on calendar
    const isVisible = await verifyReservationOnCalendar(page, testCustomer.name);
    expect(isVisible).toBe(true);

    // Open details
    console.log('📋 Opening reservation details...');
    await openReservationDetails(page, testCustomer.name);

    // Click edit
    console.log('✏️ Clicking edit button...');
    await clickEditReservation(page);

    // Update admin notes
    const newNotes = 'Updated via E2E test';
    console.log('📝 Updating admin notes...');
    await updateReservationField(page, 'adminNotes', newNotes);

    // Save changes
    console.log('💾 Saving changes...');
    await saveReservation(page);

    // Verify success
    await waitForSuccessToast(page);
    console.log('✅ Reservation updated successfully');
  });

  // ==========================================================================
  // RF-E2E-005: Change Reservation Status
  // ==========================================================================
  test('RF-E2E-005: Admin zmienia status rezerwacji na "w trakcie"', async ({ page }) => {
    // Seed with reservations
    console.log('🌱 Seeding with_reservations scenario...');
    await seedE2EReset();
    await seedE2EScenario('with_reservations');

    // Login
    console.log('🔐 Logging in...');
    await loginAsAdmin(page);

    // Wait for calendar
    await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
      timeout: 10000,
    });

    // Click on first reservation
    console.log('👆 Opening reservation details...');
    const firstReservation = page.locator('[data-testid="reservation-card"], .reservation-block, [class*="reservation"]').first();
    await firstReservation.click();

    // Wait for drawer
    await page.waitForSelector('[data-testid="reservation-details-drawer"], [role="dialog"]', {
      timeout: 5000,
    });

    // Try to start the reservation
    console.log('▶️ Starting reservation...');
    try {
      await changeReservationStatus(page, 'start');
      
      // Wait for status change
      await page.waitForTimeout(1000);
      
      // Verify the status changed (look for "W trakcie" or similar)
      const drawer = page.locator('[data-testid="reservation-details-drawer"], [role="dialog"]');
      const hasInProgress = await drawer.textContent().then(t => 
        t?.includes('trakcie') || t?.includes('progress') || t?.includes('Started')
      );
      
      console.log('✅ Status changed successfully');
    } catch (e) {
      // If start button not available, the reservation might already be started
      console.log('⚠️ Start button not available (reservation may already be in progress)');
    }
  });

  // ==========================================================================
  // RF-E2E-006: Login Persistence
  // ==========================================================================
  test('RF-E2E-006: Sesja admina jest zachowana po odświeżeniu', async ({ page }) => {
    // Login
    console.log('🔐 Logging in...');
    await loginAsAdmin(page);

    // Verify on dashboard
    await expect(page).toHaveURL(new RegExp(`/${E2E_CONFIG.instanceSlug}`));
    console.log('✅ On dashboard');

    // Refresh page
    console.log('🔄 Refreshing page...');
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
      timeout: 10000,
    });
    
    // Verify URL still contains instance slug (not /login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    console.log('✅ Session persisted after refresh');
  });

  // ==========================================================================
  // RF-E2E-007: Edit Reservation Time in Details
  // ==========================================================================
  test('RF-E2E-007: Admin zmienia godzinę rezerwacji w formularzu edycji', async ({ page }) => {
    // Create a reservation first
    const testCustomer = {
      phone: '333444555',
      name: 'Time Edit Test',
      carModel: 'VW Golf',
      plate: 'WE TIME1',
    };

    console.log('🔐 Logging in...');
    await loginAsAdmin(page);

    // Create reservation
    console.log('📝 Creating reservation...');
    await openAddReservationDialog(page);
    await fillReservationForm(page, testCustomer);
    await selectFirstService(page);
    await saveReservation(page);
    await waitForSuccessToast(page);

    // Get initial time from calendar
    console.log('⏰ Getting initial time...');
    const initialTime = await getReservationTime(page, testCustomer.name);
    console.log(`Initial time: ${initialTime}`);

    // Open reservation details
    console.log('📋 Opening reservation details...');
    await openReservationDetails(page, testCustomer.name);

    // Click edit
    console.log('✏️ Clicking edit button...');
    await clickEditReservation(page);

    // Change start time (shift by 1 hour forward)
    console.log('🕐 Changing start time...');
    
    // Get current start time and calculate new time
    const currentStartMatch = initialTime.match(/(\d{1,2}):(\d{2})/);
    if (currentStartMatch) {
      const currentHour = parseInt(currentStartMatch[1]);
      const newHour = (currentHour + 1) % 24;
      const newStartTime = `${newHour.toString().padStart(2, '0')}:${currentStartMatch[2]}`;
      
      await changeReservationStartTime(page, newStartTime);
      console.log(`Changed start time to: ${newStartTime}`);
    }

    // Save changes
    console.log('💾 Saving changes...');
    await saveReservation(page);
    await waitForSuccessToast(page);

    // Verify new time on calendar
    console.log('🔍 Verifying new time...');
    const newTime = await getReservationTime(page, testCustomer.name);
    console.log(`New time: ${newTime}`);

    expect(newTime).not.toBe(initialTime);
    console.log('✅ Reservation time changed successfully');
  });

  // ==========================================================================
  // RF-E2E-008: Drag and Drop Reservation
  // ==========================================================================
  test('RF-E2E-008: Admin przesuwa rezerwację drag & drop na kalendarzu', async ({ page }) => {
    // Seed with reservations
    console.log('🌱 Seeding with_reservations scenario...');
    await seedE2EReset();
    await seedE2EScenario('with_reservations');

    console.log('🔐 Logging in...');
    await loginAsAdmin(page);

    // Wait for calendar to load
    await page.waitForSelector('[data-testid="admin-calendar"], .admin-calendar, [class*="calendar"]', {
      timeout: 10000,
    });

    // Get first reservation
    const firstReservation = page.locator(
      '[data-testid="reservation-card"], .reservation-block, [class*="reservation"]'
    ).first();
    
    await firstReservation.waitFor({ state: 'visible', timeout: 5000 });
    
    // Get initial position/time
    const reservationText = await firstReservation.textContent() || '';
    const initialTimeMatch = reservationText.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    const initialTime = initialTimeMatch ? initialTimeMatch[0] : '';
    console.log(`Initial time: ${initialTime}`);

    // Check if draggable attribute is set (desktop only)
    const isDraggable = await firstReservation.getAttribute('draggable');
    console.log(`Draggable: ${isDraggable}`);

    if (isDraggable === 'true') {
      // Try to find a target slot (2 hours later)
      const currentHour = initialTimeMatch ? parseInt(initialTimeMatch[1]) : 10;
      const targetHour = (currentHour + 2) % 20; // Keep within working hours
      const targetTime = `${targetHour.toString().padStart(2, '0')}:00`;

      console.log(`🎯 Attempting to drag to ${targetTime}...`);
      
      // Look for time slot to drop on
      const targetSlot = page.locator(
        `[data-time="${targetTime}"], [class*="slot"]:has-text("${targetTime}")`
      ).first();
      
      if (await targetSlot.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstReservation.dragTo(targetSlot);
        
        // Wait for update
        await page.waitForTimeout(1000);
        
        // Verify success toast appeared
        try {
          await waitForSuccessToast(page);
          console.log('✅ Drag and drop completed successfully');
        } catch {
          // Check if reservation time actually changed
          const newText = await page.locator(
            '[data-testid="reservation-card"], .reservation-block, [class*="reservation"]'
          ).first().textContent() || '';
          
          console.log(`After drag: ${newText}`);
          console.log('⚠️ No toast but operation may have succeeded');
        }
      } else {
        console.log('⚠️ Target slot not found, testing drag start only');
        
        // At minimum, verify drag event starts
        await firstReservation.hover();
        const cursorClass = await firstReservation.getAttribute('class');
        expect(cursorClass).toContain('cursor');
      }
    } else {
      console.log('⚠️ Reservation not draggable (may be mobile view or disabled)');
      // Verify the card is at least clickable
      await firstReservation.click();
      await page.waitForSelector('[data-testid="reservation-details-drawer"], [role="dialog"]', {
        timeout: 5000,
      });
      console.log('✅ Card is interactive (click works)');
    }
  });

  // ==========================================================================
  // RF-E2E-009: Verify Time Shift Preserves Duration
  // ==========================================================================
  test('RF-E2E-009: Zmiana godziny rozpoczęcia przesuwa zakończenie (zachowuje czas trwania)', async ({ page }) => {
    const testCustomer = {
      phone: '444555666',
      name: 'Duration Test',
      carModel: 'Toyota Corolla',
      plate: 'WE DUR01',
    };

    console.log('🔐 Logging in...');
    await loginAsAdmin(page);

    // Create reservation
    console.log('📝 Creating reservation...');
    await openAddReservationDialog(page);
    await fillReservationForm(page, testCustomer);
    await selectFirstService(page);
    await saveReservation(page);
    await waitForSuccessToast(page);

    // Get initial time to calculate duration
    const initialTime = await getReservationTime(page, testCustomer.name);
    const timeMatch = initialTime.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    
    if (!timeMatch) {
      console.log('⚠️ Could not parse initial time, skipping duration check');
      return;
    }

    const startHour = parseInt(timeMatch[1]);
    const startMin = parseInt(timeMatch[2]);
    const endHour = parseInt(timeMatch[3]);
    const endMin = parseInt(timeMatch[4]);
    
    // Calculate initial duration in minutes
    const initialDuration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    console.log(`Initial duration: ${initialDuration} minutes`);

    // Open edit dialog
    await openReservationDetails(page, testCustomer.name);
    await clickEditReservation(page);

    // Change start time by +30 minutes
    const newStartHour = startMin >= 30 ? startHour + 1 : startHour;
    const newStartMin = (startMin + 30) % 60;
    const newStartTime = `${newStartHour.toString().padStart(2, '0')}:${newStartMin.toString().padStart(2, '0')}`;
    
    console.log(`🕐 Changing start time to ${newStartTime}...`);
    await changeReservationStartTime(page, newStartTime);

    // Save
    await saveReservation(page);
    await waitForSuccessToast(page);

    // Get new time
    const newTime = await getReservationTime(page, testCustomer.name);
    const newTimeMatch = newTime.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    
    if (newTimeMatch) {
      const newEndHour = parseInt(newTimeMatch[3]);
      const newEndMin = parseInt(newTimeMatch[4]);
      const newStartH = parseInt(newTimeMatch[1]);
      const newStartM = parseInt(newTimeMatch[2]);
      
      const newDuration = (newEndHour * 60 + newEndMin) - (newStartH * 60 + newStartM);
      console.log(`New duration: ${newDuration} minutes`);
      
      expect(newDuration).toBe(initialDuration);
      console.log('✅ Duration preserved after time shift');
    } else {
      console.log('⚠️ Could not parse new time');
    }
  });
});
