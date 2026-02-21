import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate an array of "HH:MM" time strings from `min` to `max` (inclusive)
 * with the given step in minutes.
 */
export function generateTimeSlots(min: string, max: string, stepMinutes: number): string[] {
  const [minH, minM] = min.split(':').map(Number);
  const [maxH, maxM] = max.split(':').map(Number);
  const result: string[] = [];
  let h = minH, m = minM;
  while (h < maxH || (h === maxH && m <= maxM)) {
    result.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    m += stepMinutes;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }
  return result;
}

/**
 * Compute time range boundaries from working hours for a given date.
 * Returns open time as min, close+1h (capped at 23:59) as max.
 * Fallback: 06:00–22:00.
 */
export function getWorkingHoursRange(
  workingHours: Record<string, { open: string; close: string } | null> | null | undefined,
  date: Date | undefined
): { min: string; max: string } {
  const fallback = { min: '06:00', max: '22:00' };
  if (!workingHours) return fallback;
  const dayName = date
    ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
    : 'monday';
  const dayHours = workingHours[dayName];
  if (!dayHours) return fallback;
  const closeH = parseInt(dayHours.close.substring(0, 2)) + 1;
  const closeM = parseInt(dayHours.close.substring(3, 5));
  const cappedH = Math.min(closeH, 23);
  const cappedM = closeH >= 24 ? 59 : closeM;
  return {
    min: dayHours.open.substring(0, 5),
    max: `${cappedH.toString().padStart(2, '0')}:${cappedM.toString().padStart(2, '0')}`,
  };
}
