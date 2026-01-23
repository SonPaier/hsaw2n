/**
 * Shared reservation utilities for Edge Functions
 * Extracted for testability
 */

/**
 * Calculate end time based on start time and duration in minutes
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;
  const endHours = Math.floor(endMinutes / 60) % 24; // Handle overflow past midnight
  const endMins = endMinutes % 60;
  return `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
}

/**
 * Generate a random 7-digit confirmation code
 */
export function generateConfirmationCode(): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

/**
 * Generate a 4-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Format date for SMS message
 */
export function formatDateForSms(dateStr: string): { dayName: string; dayNum: number; monthName: string; monthNameFull: string } {
  const dateObj = new Date(dateStr);
  const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
  const monthNamesFull = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  
  return {
    dayName: dayNames[dateObj.getDay()],
    dayNum: dateObj.getDate(),
    monthName: monthNames[dateObj.getMonth()],
    monthNameFull: monthNamesFull[dateObj.getMonth()],
  };
}

/**
 * Build SMS message for reservation confirmation
 */
export function buildConfirmationSms(params: {
  instanceName: string;
  dayNum: number;
  monthNameFull: string;
  time: string;
  autoConfirm: boolean;
  googleMapsUrl?: string | null;
  editUrl?: string | null;
}): string {
  const { instanceName, dayNum, monthNameFull, time, autoConfirm, googleMapsUrl, editUrl } = params;
  
  const mapsLinkPart = googleMapsUrl ? ` Dojazd: ${googleMapsUrl}` : "";
  const editLinkPart = editUrl ? ` Zmien lub anuluj: ${editUrl}` : "";
  
  if (autoConfirm) {
    return `${instanceName}: Rezerwacja potwierdzona! ${dayNum} ${monthNameFull} o ${time}.${mapsLinkPart}${editLinkPart}`;
  } else {
    return `${instanceName}: Otrzymalismy prosbe o rezerwacje: ${dayNum} ${monthNameFull} o ${time}. Potwierdzimy ja wkrotce.${editLinkPart}`;
  }
}

/**
 * Build SMS message for verification code
 */
export function buildVerificationSms(instanceName: string, code: string): string {
  return `Kod potwierdzajacy ${instanceName}: ${code}`;
}

/**
 * Validate required fields for direct reservation
 */
export function validateDirectReservationRequest(data: {
  instanceId?: string;
  phone?: string;
  reservationData?: unknown;
}): { valid: boolean; error?: string } {
  if (!data.instanceId) {
    return { valid: false, error: "Missing instanceId" };
  }
  if (!data.phone) {
    return { valid: false, error: "Missing phone" };
  }
  if (!data.reservationData) {
    return { valid: false, error: "Missing reservationData" };
  }
  return { valid: true };
}

/**
 * Validate required fields for SMS code request
 */
export function validateSendSmsRequest(data: {
  phone?: string;
  instanceId?: string;
  reservationData?: unknown;
}): { valid: boolean; error?: string } {
  if (!data.phone) {
    return { valid: false, error: "Missing phone" };
  }
  if (!data.instanceId) {
    return { valid: false, error: "Missing instanceId" };
  }
  if (!data.reservationData) {
    return { valid: false, error: "Missing reservationData" };
  }
  return { valid: true };
}

/**
 * Validate required fields for SMS verification
 */
export function validateVerifySmsRequest(data: {
  phone?: string;
  code?: string;
  instanceId?: string;
}): { valid: boolean; error?: string } {
  if (!data.phone) {
    return { valid: false, error: "Missing phone" };
  }
  if (!data.code) {
    return { valid: false, error: "Missing code" };
  }
  if (!data.instanceId) {
    return { valid: false, error: "Missing instanceId" };
  }
  return { valid: true };
}

/**
 * Parse car model from vehicle plate string
 */
export function parseCarModel(vehiclePlate: string): { brand: string; name: string } {
  const parts = vehiclePlate.trim().split(/\s+/);
  const brand = parts[0] || 'Do weryfikacji';
  const name = parts.length > 1 ? parts.slice(1).join(' ') : vehiclePlate;
  return { brand, name: name || brand };
}

/**
 * Convert car size string to database size code
 */
export function mapCarSize(carSize?: string): string {
  switch (carSize) {
    case 'small': return 'S';
    case 'large': return 'L';
    default: return 'M';
  }
}
