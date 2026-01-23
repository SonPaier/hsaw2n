/**
 * Timezone and Reminder utilities for Edge Functions
 * Extracted for testability
 */

// ========================
// TIMEZONE HELPER FUNCTIONS
// ========================

/**
 * Get date/time components in a specific timezone using Intl.DateTimeFormat
 */
export function getDateTimeInTimezone(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dateStr: string; // YYYY-MM-DD
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  return { year, month, day, hours, minutes, dateStr };
}

/**
 * Get "tomorrow" date string in a specific timezone
 */
export function getTomorrowInTimezone(date: Date, timezone: string): string {
  // Add 24 hours to the current date
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return getDateTimeInTimezone(tomorrow, timezone).dateStr;
}

/**
 * Calculate minutes until a reservation starts, accounting for timezone
 * The reservation_date + start_time are LOCAL times in the instance timezone
 */
export function calculateMinutesUntilStart(
  nowUtc: Date,
  reservationDate: string, // YYYY-MM-DD
  startTime: string, // HH:MM:SS
  timezone: string
): number {
  // Get current time in instance timezone
  const nowLocal = getDateTimeInTimezone(nowUtc, timezone);
  const nowTotalMinutes = nowLocal.hours * 60 + nowLocal.minutes;
  
  // Parse reservation start time
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;
  
  // Get today in instance timezone
  const todayLocal = nowLocal.dateStr;
  
  // If reservation is today
  if (reservationDate === todayLocal) {
    return startTotalMinutes - nowTotalMinutes;
  }
  
  // If reservation is tomorrow, add 24*60 minutes
  const tomorrowLocal = getTomorrowInTimezone(nowUtc, timezone);
  if (reservationDate === tomorrowLocal) {
    return (24 * 60) + startTotalMinutes - nowTotalMinutes;
  }
  
  // Otherwise, reservation is not today or tomorrow - return large negative (skip)
  return -9999;
}

/**
 * Check if current time is within the reminder window
 * @param nowMinutes Current time in minutes from midnight
 * @param targetMinutes Target send time in minutes from midnight
 * @param windowMinutes Window size in minutes (default 5)
 */
export function isWithinReminderWindow(
  nowMinutes: number,
  targetMinutes: number,
  windowMinutes: number = 5
): boolean {
  return Math.abs(nowMinutes - targetMinutes) <= windowMinutes;
}

/**
 * Check if reservation is in the 1-hour reminder window (55-65 min before start)
 */
export function isIn1HourReminderWindow(minutesUntilStart: number): boolean {
  // Between 55 and 65 minutes before start
  return minutesUntilStart >= 55 && minutesUntilStart <= 65;
}

/**
 * Parse time string (HH:MM or HH:MM:SS) to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Build reminder SMS message for 1-day reminder
 */
export function buildReminder1DaySms(params: {
  instanceName: string;
  time: string; // HH:MM
  editUrl?: string | null;
}): string {
  const editLinkPart = params.editUrl ? ` Zmien lub anuluj: ${params.editUrl}` : "";
  return `${params.instanceName}: Przypomnienie - jutro o ${params.time} masz wizyte.${editLinkPart}`;
}

/**
 * Build reminder SMS message for 1-hour reminder
 */
export function buildReminder1HourSms(params: {
  instanceName: string;
  time: string; // HH:MM
  editUrl?: string | null;
}): string {
  const editLinkPart = params.editUrl ? ` Zmien lub anuluj: ${params.editUrl}` : "";
  return `${params.instanceName}: Przypomnienie - za godzine (${params.time}) masz wizyte.${editLinkPart}`;
}

// ========================
// BACKOFF HELPER FUNCTIONS
// ========================

/**
 * Check if a claim is in backoff period
 */
export function isInBackoffPeriod(
  lastAttemptAt: string | null,
  nowUtc: Date,
  backoffMinutes: number
): boolean {
  if (!lastAttemptAt) return false;
  
  const lastAttempt = new Date(lastAttemptAt);
  const backoffThreshold = new Date(nowUtc.getTime() - backoffMinutes * 60 * 1000);
  
  return lastAttempt > backoffThreshold;
}

/**
 * Should mark as permanent failure
 */
export function shouldMarkPermanentFailure(
  failureCount: number,
  maxFailures: number = 3
): boolean {
  return failureCount >= maxFailures;
}
