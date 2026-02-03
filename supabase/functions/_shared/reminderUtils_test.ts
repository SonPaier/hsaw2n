import "jsr:@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import {
  getDateTimeInTimezone,
  getTomorrowInTimezone,
  calculateMinutesUntilStart,
  isWithinReminderWindow,
  isIn1HourReminderWindow,
  parseTimeToMinutes,
  buildReminder1DaySms,
  buildReminder1HourSms,
  buildReminderTodaySms,
  isInHourlyWindow,
  HOURLY_WINDOWS,
  isInBackoffPeriod,
  shouldMarkPermanentFailure,
} from "./reminderUtils.ts";

// ============================================================================
// SRE - Send Reminders Tests
// ============================================================================

Deno.test("SRE-002: getDateTimeInTimezone - Europe/Warsaw", () => {
  // 2026-01-24 10:00 UTC
  const date = new Date("2026-01-24T10:00:00Z");
  const result = getDateTimeInTimezone(date, "Europe/Warsaw");
  
  assertEquals(result.year, 2026);
  assertEquals(result.month, 1);
  assertEquals(result.day, 24);
  // Warsaw is UTC+1 in January (no DST)
  assertEquals(result.hours, 11);
  assertEquals(result.minutes, 0);
  assertEquals(result.dateStr, "2026-01-24");
});

Deno.test("SRE-002b: getDateTimeInTimezone - handles day boundary", () => {
  // 2026-01-24 23:30 UTC -> 2026-01-25 00:30 Warsaw
  const date = new Date("2026-01-24T23:30:00Z");
  const result = getDateTimeInTimezone(date, "Europe/Warsaw");
  
  assertEquals(result.dateStr, "2026-01-25");
  assertEquals(result.hours, 0);
  assertEquals(result.minutes, 30);
});

Deno.test("SRE-003: getTomorrowInTimezone - simple case", () => {
  const date = new Date("2026-01-24T10:00:00Z");
  const tomorrow = getTomorrowInTimezone(date, "Europe/Warsaw");
  
  assertEquals(tomorrow, "2026-01-25");
});

Deno.test("SRE-003b: getTomorrowInTimezone - month boundary", () => {
  const date = new Date("2026-01-31T10:00:00Z");
  const tomorrow = getTomorrowInTimezone(date, "Europe/Warsaw");
  
  assertEquals(tomorrow, "2026-02-01");
});

Deno.test("SRE-003c: getTomorrowInTimezone - year boundary", () => {
  const date = new Date("2025-12-31T10:00:00Z");
  const tomorrow = getTomorrowInTimezone(date, "Europe/Warsaw");
  
  assertEquals(tomorrow, "2026-01-01");
});

Deno.test("SRE-004: calculateMinutesUntilStart - reservation today", () => {
  // Now: 2026-01-24 09:00 Warsaw (08:00 UTC)
  const nowUtc = new Date("2026-01-24T08:00:00Z");
  // Reservation: 2026-01-24 at 10:00 local
  const minutes = calculateMinutesUntilStart(nowUtc, "2026-01-24", "10:00:00", "Europe/Warsaw");
  
  // 10:00 - 09:00 = 60 minutes
  assertEquals(minutes, 60);
});

Deno.test("SRE-004b: calculateMinutesUntilStart - reservation tomorrow", () => {
  // Now: 2026-01-24 20:00 Warsaw (19:00 UTC)
  const nowUtc = new Date("2026-01-24T19:00:00Z");
  // Reservation: 2026-01-25 at 09:00 local
  const minutes = calculateMinutesUntilStart(nowUtc, "2026-01-25", "09:00:00", "Europe/Warsaw");
  
  // (24*60) + 09:00 - 20:00 = 1440 + 540 - 1200 = 780 minutes = 13 hours
  assertEquals(minutes, 780);
});

Deno.test("SRE-004c: calculateMinutesUntilStart - reservation past", () => {
  // Now: 2026-01-24 10:00 Warsaw
  const nowUtc = new Date("2026-01-24T09:00:00Z");
  // Reservation: 2026-01-24 at 09:00 local (already past)
  const minutes = calculateMinutesUntilStart(nowUtc, "2026-01-24", "09:00:00", "Europe/Warsaw");
  
  // 09:00 - 10:00 = -60 minutes
  assertEquals(minutes, -60);
});

Deno.test("SRE-004d: calculateMinutesUntilStart - reservation in 2 days returns -9999", () => {
  // Now: 2026-01-24 10:00 Warsaw
  const nowUtc = new Date("2026-01-24T09:00:00Z");
  // Reservation: 2026-01-26 at 09:00 local (2 days from now)
  const minutes = calculateMinutesUntilStart(nowUtc, "2026-01-26", "09:00:00", "Europe/Warsaw");
  
  assertEquals(minutes, -9999);
});

Deno.test("SRE-009: isWithinReminderWindow - within window", () => {
  assertEquals(isWithinReminderWindow(1140, 1140, 5), true);  // exact match
  assertEquals(isWithinReminderWindow(1143, 1140, 5), true);  // 3 min after
  assertEquals(isWithinReminderWindow(1137, 1140, 5), true);  // 3 min before
});

Deno.test("SRE-009b: isWithinReminderWindow - outside window", () => {
  assertEquals(isWithinReminderWindow(1150, 1140, 5), false); // 10 min after
  assertEquals(isWithinReminderWindow(1130, 1140, 5), false); // 10 min before
});

Deno.test("SRE-004e: isIn1HourReminderWindow - valid window", () => {
  assertEquals(isIn1HourReminderWindow(55), true);
  assertEquals(isIn1HourReminderWindow(60), true);
  assertEquals(isIn1HourReminderWindow(65), true);
});

Deno.test("SRE-004f: isIn1HourReminderWindow - outside window", () => {
  assertEquals(isIn1HourReminderWindow(54), false);
  assertEquals(isIn1HourReminderWindow(66), false);
  assertEquals(isIn1HourReminderWindow(30), false);
  assertEquals(isIn1HourReminderWindow(120), false);
});

Deno.test("SRE-010: parseTimeToMinutes - standard time", () => {
  assertEquals(parseTimeToMinutes("09:00"), 540);
  assertEquals(parseTimeToMinutes("19:00:00"), 1140);
  assertEquals(parseTimeToMinutes("14:30"), 870);
  assertEquals(parseTimeToMinutes("00:00"), 0);
  assertEquals(parseTimeToMinutes("23:59"), 1439);
});

Deno.test("SRE-MSG-1: buildReminder1DaySms - without edit link", () => {
  const sms = buildReminder1DaySms({
    instanceName: "AutoSpa",
    time: "10:00",
  });
  
  assertEquals(sms, "AutoSpa: Przypomnienie - jutro o 10:00 masz wizyte.");
});

Deno.test("SRE-MSG-2: buildReminder1DaySms - with edit link", () => {
  const sms = buildReminder1DaySms({
    instanceName: "AutoSpa",
    time: "10:00",
    editUrl: "https://example.com/res?code=1234567",
  });
  
  assertEquals(sms.includes("Zmien lub anuluj: https://example.com/res?code=1234567"), true);
});

Deno.test("SRE-MSG-3: buildReminder1HourSms - without edit link", () => {
  const sms = buildReminder1HourSms({
    instanceName: "AutoSpa",
    time: "10:00",
  });
  
  assertEquals(sms, "AutoSpa: Przypomnienie - za godzine (10:00) masz wizyte.");
});

Deno.test("SRE-MSG-4: buildReminder1HourSms - with edit link", () => {
  const sms = buildReminder1HourSms({
    instanceName: "AutoSpa",
    time: "10:00",
    editUrl: "https://example.com/res?code=1234567",
  });
  
  assertEquals(sms.includes("Zmien lub anuluj: https://example.com/res?code=1234567"), true);
});

Deno.test("SRE-006: isInBackoffPeriod - no previous attempt", () => {
  const now = new Date("2026-01-24T10:00:00Z");
  assertEquals(isInBackoffPeriod(null, now, 15), false);
});

Deno.test("SRE-006b: isInBackoffPeriod - within backoff", () => {
  const now = new Date("2026-01-24T10:10:00Z");
  const lastAttempt = "2026-01-24T10:00:00Z"; // 10 minutes ago
  assertEquals(isInBackoffPeriod(lastAttempt, now, 15), true); // still in 15min backoff
});

Deno.test("SRE-006c: isInBackoffPeriod - after backoff", () => {
  const now = new Date("2026-01-24T10:20:00Z");
  const lastAttempt = "2026-01-24T10:00:00Z"; // 20 minutes ago
  assertEquals(isInBackoffPeriod(lastAttempt, now, 15), false); // past 15min backoff
});

Deno.test("SRE-008: shouldMarkPermanentFailure - below threshold", () => {
  assertEquals(shouldMarkPermanentFailure(0, 3), false);
  assertEquals(shouldMarkPermanentFailure(1, 3), false);
  assertEquals(shouldMarkPermanentFailure(2, 3), false);
});

Deno.test("SRE-008b: shouldMarkPermanentFailure - at threshold", () => {
  assertEquals(shouldMarkPermanentFailure(3, 3), true);
  assertEquals(shouldMarkPermanentFailure(4, 3), true);
});

// ============================================================================
// Additional coverage for edge cases
// ============================================================================

Deno.test("SRE-009c: isWithinReminderWindow - edge of window (exactly 5 min)", () => {
  assertEquals(isWithinReminderWindow(1145, 1140, 5), true);  // exactly 5 min after
  assertEquals(isWithinReminderWindow(1135, 1140, 5), true);  // exactly 5 min before
});

Deno.test("SRE-009d: isWithinReminderWindow - just outside window", () => {
  assertEquals(isWithinReminderWindow(1146, 1140, 5), false); // 6 min after
  assertEquals(isWithinReminderWindow(1134, 1140, 5), false); // 6 min before
});

Deno.test("SRE-002c: getDateTimeInTimezone - summer time (DST)", () => {
  // 2026-07-15 10:00 UTC - Warsaw should be UTC+2 (CEST)
  const date = new Date("2026-07-15T10:00:00Z");
  const result = getDateTimeInTimezone(date, "Europe/Warsaw");
  
  assertEquals(result.hours, 12); // UTC+2 in summer
  assertEquals(result.dateStr, "2026-07-15");
});

Deno.test("SRE-002d: getDateTimeInTimezone - different timezone (UTC)", () => {
  const date = new Date("2026-01-24T10:00:00Z");
  const result = getDateTimeInTimezone(date, "UTC");
  
  assertEquals(result.hours, 10);
  assertEquals(result.minutes, 0);
});

Deno.test("SRE-004g: calculateMinutesUntilStart - exact boundary (midnight)", () => {
  // Now: 2026-01-24 00:00 Warsaw (23:00 UTC previous day)
  const nowUtc = new Date("2026-01-23T23:00:00Z");
  // Reservation: 2026-01-24 at 01:00 local
  const minutes = calculateMinutesUntilStart(nowUtc, "2026-01-24", "01:00:00", "Europe/Warsaw");
  
  assertEquals(minutes, 60);
});

Deno.test("SRE-006d: isInBackoffPeriod - exactly at backoff boundary", () => {
  const now = new Date("2026-01-24T10:15:00Z");
  const lastAttempt = "2026-01-24T10:00:00Z"; // exactly 15 minutes ago
  // At exactly 15 min, lastAttempt is NOT > backoffThreshold (it's equal)
  assertEquals(isInBackoffPeriod(lastAttempt, now, 15), false);
});

Deno.test("SRE-008c: shouldMarkPermanentFailure - default threshold", () => {
  // Test with default maxFailures (3)
  assertEquals(shouldMarkPermanentFailure(2), false);
  assertEquals(shouldMarkPermanentFailure(3), true);
});

Deno.test("SRE-MSG-5: buildReminder1DaySms - with null editUrl", () => {
  const sms = buildReminder1DaySms({
    instanceName: "AutoSpa",
    time: "10:00",
    editUrl: null,
  });
  
  assertEquals(sms.includes("Zmien lub anuluj"), false);
});

Deno.test("SRE-MSG-6: buildReminder1HourSms - with null editUrl", () => {
  const sms = buildReminder1HourSms({
    instanceName: "AutoSpa",
    time: "10:00",
    editUrl: null,
  });
  
  assertEquals(sms.includes("Zmien lub anuluj"), false);
});

// ============================================================================
// New "Today" SMS and Hourly Window Tests
// ============================================================================

Deno.test("SRE-TODAY-1: buildReminderTodaySms - with phone", () => {
  const sms = buildReminderTodaySms({
    instanceName: "Armcar",
    time: "10:00",
    phone: "123456789",
  });
  
  assertEquals(sms, "Armcar: Dzisiaj masz wizyte o 10:00 - czekamy na Ciebie i Twoje autko! :) Tel: 123456789");
  assertEquals(sms.length <= 160, true); // Verify GSM-7 limit
});

Deno.test("SRE-TODAY-2: buildReminderTodaySms - without phone", () => {
  const sms = buildReminderTodaySms({
    instanceName: "Armcar",
    time: "10:00",
  });
  
  assertEquals(sms, "Armcar: Dzisiaj masz wizyte o 10:00 - czekamy na Ciebie i Twoje autko! :)");
});

Deno.test("SRE-TODAY-3: buildReminderTodaySms - with null phone", () => {
  const sms = buildReminderTodaySms({
    instanceName: "AutoSpa",
    time: "14:30",
    phone: null,
  });
  
  assertEquals(sms.includes("Tel:"), false);
  assertEquals(sms, "AutoSpa: Dzisiaj masz wizyte o 14:30 - czekamy na Ciebie i Twoje autko! :)");
});

Deno.test("SRE-TODAY-4: buildReminderTodaySms - max length check with long name", () => {
  const sms = buildReminderTodaySms({
    instanceName: "Super Długa Nazwa Myjni",
    time: "10:00",
    phone: "+48123456789",
  });
  
  // Should still be under 160 chars
  assertEquals(sms.length <= 160, true);
});

Deno.test("SRE-WINDOW-1: isInHourlyWindow - window 1 (08:00-10:59)", () => {
  assertEquals(isInHourlyWindow("08:00:00", 1), true);
  assertEquals(isInHourlyWindow("08:30:00", 1), true);
  assertEquals(isInHourlyWindow("10:30:00", 1), true);
  assertEquals(isInHourlyWindow("10:59:00", 1), true);
  assertEquals(isInHourlyWindow("11:00:00", 1), false); // edge - belongs to window 2
  assertEquals(isInHourlyWindow("07:59:00", 1), false); // too early
});

Deno.test("SRE-WINDOW-2: isInHourlyWindow - window 2 (11:00-13:59)", () => {
  assertEquals(isInHourlyWindow("11:00:00", 2), true);
  assertEquals(isInHourlyWindow("12:30:00", 2), true);
  assertEquals(isInHourlyWindow("13:30:00", 2), true);
  assertEquals(isInHourlyWindow("13:59:00", 2), true);
  assertEquals(isInHourlyWindow("14:00:00", 2), false); // edge - belongs to window 3
  assertEquals(isInHourlyWindow("10:59:00", 2), false); // belongs to window 1
});

Deno.test("SRE-WINDOW-3: isInHourlyWindow - window 3 (14:00-15:59)", () => {
  assertEquals(isInHourlyWindow("14:00:00", 3), true);
  assertEquals(isInHourlyWindow("15:00:00", 3), true);
  assertEquals(isInHourlyWindow("15:30:00", 3), true);
  assertEquals(isInHourlyWindow("15:59:00", 3), true);
  assertEquals(isInHourlyWindow("16:00:00", 3), false); // outside window
  assertEquals(isInHourlyWindow("13:59:00", 3), false); // belongs to window 2
});

Deno.test("SRE-WINDOW-4: isInHourlyWindow - invalid window number", () => {
  assertEquals(isInHourlyWindow("10:00:00", 0), false);
  assertEquals(isInHourlyWindow("10:00:00", 4), false);
  assertEquals(isInHourlyWindow("10:00:00", 99), false);
});

Deno.test("SRE-WINDOW-5: isInHourlyWindow - HH:MM format (without seconds)", () => {
  assertEquals(isInHourlyWindow("09:00", 1), true);
  assertEquals(isInHourlyWindow("12:00", 2), true);
  assertEquals(isInHourlyWindow("15:00", 3), true);
});

Deno.test("SRE-WINDOW-6: HOURLY_WINDOWS constants", () => {
  assertEquals(HOURLY_WINDOWS[1].startHour, 8);
  assertEquals(HOURLY_WINDOWS[1].endHour, 11);
  assertEquals(HOURLY_WINDOWS[2].startHour, 11);
  assertEquals(HOURLY_WINDOWS[2].endHour, 14);
  assertEquals(HOURLY_WINDOWS[3].startHour, 14);
  assertEquals(HOURLY_WINDOWS[3].endHour, 16);
});
