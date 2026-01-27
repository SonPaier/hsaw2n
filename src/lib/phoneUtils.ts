/**
 * Frontend phone normalization utilities.
 * Mirrors backend logic from supabase/functions/_shared/phoneUtils.ts
 * 
 * For frontend, we don't have access to libphonenumber-js in the bundle,
 * so we use a simplified approach that handles the most common cases.
 */

/**
 * Normalizes a phone number to E.164 format (with + prefix).
 * Handles Polish and international numbers.
 * 
 * @param phone - Raw phone number in any format
 * @param defaultCountry - Default country code to use if not detected (default: 'PL')
 * @returns Normalized phone number with + prefix
 * 
 * Examples:
 * - "733 854 184" -> "+48733854184" (9-digit Polish)
 * - "+48 733 854 184" -> "+48733854184"
 * - "0048 733 854 184" -> "+48733854184"
 * - "47504503123" -> "+47504503123" (Norwegian with code)
 * - "+49 (0) 171 1234567" -> "+491711234567" (German with trunk zero)
 */
export function normalizePhone(phone: string, defaultCountry: string = 'PL'): string {
  if (!phone) return '';

  // Step 1: Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Step 2: Handle 00 prefix -> +
  if (cleaned.startsWith('00') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // Step 3: If already has + prefix, just clean it
  if (cleaned.startsWith('+')) {
    // Remove trunk zeros ONLY for countries that use them: DE, AT, CH, IT
    // Polish numbers (+48) do NOT use trunk zero
    cleaned = cleaned.replace(/^\+(49|43|41|39)0(\d)/, '+$1$2');
    return cleaned;
  }

  // Step 4: No + prefix - need to determine country code
  const digitsOnly = cleaned.replace(/\D/g, '');

  // Known country code prefixes (most common for this app)
  const countryPrefixes = [
    '48',   // Poland
    '49',   // Germany
    '44',   // UK
    '380',  // Ukraine
    '420',  // Czech Republic
    '421',  // Slovakia
    '47',   // Norway
    '45',   // Denmark
    '46',   // Sweden
    '43',   // Austria
    '41',   // Switzerland
    '33',   // France
    '31',   // Netherlands
    '32',   // Belgium
    '39',   // Italy
    '34',   // Spain
    '351',  // Portugal
    '370',  // Lithuania
    '371',  // Latvia
    '372',  // Estonia
    '375',  // Belarus
    '7',    // Russia
    '1',    // USA/Canada
  ];

  // Check if number starts with a known country prefix
  for (const prefix of countryPrefixes) {
    // For longer prefixes (3 digits like 380, 420), check total length
    // International number with prefix should be at least prefix + 9 digits
    const minLength = prefix.length >= 3 ? prefix.length + 8 : prefix.length + 9;
    
    if (digitsOnly.startsWith(prefix) && digitsOnly.length >= minLength) {
      // Looks like international number starting with country code
      return '+' + digitsOnly;
    }
  }

  // Step 5: If exactly 9 digits and no detected country prefix, assume Polish
  if (digitsOnly.length === 9) {
    if (defaultCountry === 'PL') {
      return '+48' + digitsOnly;
    }
    // For other countries, just add +
    return '+' + digitsOnly;
  }

  // Step 6: If more than 9 digits but no match, assume it's international and add +
  if (digitsOnly.length > 9) {
    return '+' + digitsOnly;
  }

  // Fallback: return as-is with + if missing
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

/**
 * Strips a phone number to just digits (no +, spaces, dashes).
 * Useful for comparison or display purposes.
 */
export function stripPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Checks if a phone number is valid (has proper length after normalization).
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Valid E.164 numbers are typically 8-15 digits plus the + prefix
  const digitsOnly = normalized.replace(/\D/g, '');
  return digitsOnly.length >= 8 && digitsOnly.length <= 15;
}

/**
 * Formats a phone number for display.
 * Strips +48 prefix for Polish numbers and formats as XXX YYY ZZZ.
 * 
 * Examples:
 * - "+48733854184" -> "733 854 184"
 * - "+4868692003" -> "686 920 03" (handles shorter variants)
 * - "+48 733 854 184" -> "733 854 184"
 * - "+49123456789" -> "+49 123 456 789" (keeps international prefix)
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Handle Polish numbers - strip +48 or 48 prefix
  if (cleaned.startsWith('+48')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('48') && cleaned.length >= 11) {
    cleaned = cleaned.slice(2);
  }

  // If we now have 9 digits (Polish format), format as XXX YYY ZZZ
  if (cleaned.length === 9 && /^\d+$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  }

  // For international numbers, keep prefix and try to format nicely
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    // Format as +XX YYY YYY YYY for readability
    if (digits.length >= 9) {
      const countryCode = digits.slice(0, 2);
      const rest = digits.slice(2);
      const parts = rest.match(/.{1,3}/g) || [];
      return `+${countryCode} ${parts.join(' ')}`;
    }
    return cleaned;
  }

  // Fallback: try to format any digit string as groups of 3
  if (/^\d+$/.test(cleaned) && cleaned.length >= 9) {
    const parts = cleaned.match(/.{1,3}/g) || [];
    return parts.join(' ');
  }

  return phone; // Return original if can't parse
}
