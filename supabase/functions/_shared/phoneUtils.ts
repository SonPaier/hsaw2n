import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from "https://esm.sh/libphonenumber-js@1.11.17";

export interface NormalizedPhoneResult {
  phone: string;
  isValid: boolean;
  countryCode?: string;
  error?: string;
}

/**
 * Professional phone number normalization using libphonenumber-js.
 * Handles:
 * - Various input formats (spaces, dashes, parentheses)
 * - International prefixes (00, +)
 * - Trunk zero removal (e.g., +49 (0) 171...)
 * - Country code detection
 * 
 * @param phone - Phone number in any format
 * @param defaultCountry - Default country if cannot be detected (ISO 3166-1 alpha-2)
 * @returns Object with normalized E.164 phone number or error
 */
export function normalizePhone(
  phone: string,
  defaultCountry: CountryCode = "PL"
): NormalizedPhoneResult {
  if (!phone) {
    return { phone: "", isValid: false, error: "Empty phone number" };
  }

  // 1. Initial cleanup - remove spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  
  // 2. Replace 00 with + for international format
  if (cleaned.startsWith("00") && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(2);
  }
  
  // 3. Handle +00 format (e.g., +0049 -> +49)
  if (cleaned.startsWith("+00")) {
    cleaned = "+" + cleaned.slice(3);
  }

  // 4. Remove trunk zero after country code: +48 (0) -> +48, +49 (0) -> +49
  // Pattern: +XX0... where XX is 2-3 digit country code followed by 0
  cleaned = cleaned.replace(/^(\+\d{1,3})0(\d)/, "$1$2");

  try {
    // 5. Try parsing with libphonenumber-js
    const parsed = parsePhoneNumber(cleaned, defaultCountry);
    
    if (parsed && parsed.isValid()) {
      return {
        phone: parsed.number, // E.164 format: +48733854184
        isValid: true,
        countryCode: parsed.country,
      };
    }
    
    // 6. If failed, try adding + prefix and parse again
    if (!cleaned.startsWith("+")) {
      const withPlus = "+" + cleaned;
      const retryParsed = parsePhoneNumber(withPlus);
      
      if (retryParsed && retryParsed.isValid()) {
        return {
          phone: retryParsed.number,
          isValid: true,
          countryCode: retryParsed.country,
        };
      }
    }
    
    // 7. If still failed, return with error but include parsed number if available
    return {
      phone: parsed?.number || cleaned,
      isValid: false,
      error: `Invalid phone for country ${parsed?.country || defaultCountry}`,
    };

  } catch (e) {
    // 8. Parse error - return cleaned number with error
    return {
      phone: cleaned,
      isValid: false,
      error: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Quick normalization with fallback - always returns a string.
 * Use when you need to send SMS regardless of validation status.
 * 
 * Fallback logic for numbers that libphonenumber can't parse:
 * - 9 digits without + → add default country prefix
 * - 11+ digits without + that look like international → add +
 * - Otherwise → add default country prefix
 * 
 * @param phone - Phone number in any format
 * @param defaultCountry - Default country code (ISO 3166-1 alpha-2)
 * @returns E.164 formatted phone number (best effort)
 */
export function normalizePhoneOrFallback(
  phone: string,
  defaultCountry: CountryCode = "PL"
): string {
  const result = normalizePhone(phone, defaultCountry);
  
  if (result.isValid) {
    return result.phone;
  }
  
  // Fallback: manual normalization for "almost correct" numbers
  let fallback = phone.replace(/[\s\-\(\)\.]/g, "");
  
  // Handle 00 prefix
  if (fallback.startsWith("00") && !fallback.startsWith("+")) {
    fallback = "+" + fallback.slice(2);
  }
  
  // Handle +00 prefix
  if (fallback.startsWith("+00")) {
    fallback = "+" + fallback.slice(3);
  }
  
  // Remove trunk zero after country code (common in DE, AT, but NOT after 380, 420, etc.)
  // Pattern: +XX0... where XX is 2 digit country code followed by 0 (but not 380, 420, 421 etc.)
  // Only apply for known trunk-zero countries: +49, +43, +41, +39
  fallback = fallback.replace(/^(\+(?:49|43|41|39))0(\d)/, "$1$2");
  
  // FIX: Detect and fix double prefix patterns like +4848, 4848, 004848
  // Pattern: starts with +48 followed by 48 again
  if (fallback.startsWith("+4848")) {
    fallback = "+48" + fallback.slice(5);
  }
  // Pattern: starts with 4848 (without +)
  else if (fallback.startsWith("4848") && !fallback.startsWith("+")) {
    fallback = "+48" + fallback.slice(4);
  }
  
  if (!fallback.startsWith("+")) {
    // Get default country calling code
    const countryCallingCodes: Record<string, string> = {
      PL: "48",
      DE: "49",
      GB: "44",
      US: "1",
      UA: "380",
      CZ: "420",
      SK: "421",
      AT: "43",
      CH: "41",
      FR: "33",
      IT: "39",
      ES: "34",
      NL: "31",
      BE: "32",
    };
    
    const defaultCallingCode = countryCallingCodes[defaultCountry] || "48";
    
    // If exactly 9 digits - add default country prefix
    if (/^\d{9}$/.test(fallback)) {
      fallback = "+" + defaultCallingCode + fallback;
    }
    // If 11 digits starting with 48 - it's already a Polish number, just add +
    else if (fallback.length === 11 && fallback.startsWith("48")) {
      fallback = "+" + fallback;
    }
    // If 11+ digits and starts with a known country code - add +
    else if (fallback.length >= 11 && /^(48|49|44|380|420|421|43|41|33|39|34|31|32|1)/.test(fallback)) {
      fallback = "+" + fallback;
    }
    // Otherwise add default country prefix
    else {
      fallback = "+" + defaultCallingCode + fallback;
    }
  }
  
  return fallback;
}

/**
 * Validate phone number without normalizing.
 * 
 * @param phone - Phone number to validate
 * @param defaultCountry - Default country for validation
 * @returns true if valid, false otherwise
 */
export function isValidPhone(
  phone: string,
  defaultCountry: CountryCode = "PL"
): boolean {
  return normalizePhone(phone, defaultCountry).isValid;
}
