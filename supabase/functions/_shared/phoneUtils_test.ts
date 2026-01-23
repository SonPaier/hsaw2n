import "jsr:@std/dotenv/load";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { normalizePhone, normalizePhoneOrFallback, isValidPhone } from "./phoneUtils.ts";

// ============================================================================
// PHU - Phone Utils Tests
// ============================================================================

Deno.test("PHU-001: normalizePhone - 9 digits → +48 prefix", () => {
  const result = normalizePhone("733854184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
  assertEquals(result.countryCode, "PL");
});

Deno.test("PHU-002: normalizePhone - 00 prefix → +", () => {
  const result = normalizePhone("0048733854184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-003: normalizePhone - +00 prefix → +", () => {
  const result = normalizePhone("+0048733854184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-004: normalizePhone - trunk zero removal (+48 (0))", () => {
  const result = normalizePhone("+48 (0) 733 854 184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-005: normalizePhoneOrFallback - double prefix fix (+4848...)", () => {
  const result = normalizePhoneOrFallback("+4848733854184");
  assertEquals(result, "+48733854184");
});

Deno.test("PHU-006: normalizePhone - German number", () => {
  const result = normalizePhone("+49 171 1234567");
  assertEquals(result.phone, "+491711234567");
  assertEquals(result.isValid, true);
  assertEquals(result.countryCode, "DE");
});

Deno.test("PHU-007: normalizePhone - UK number", () => {
  const result = normalizePhone("+44 7911 123456");
  assertEquals(result.phone, "+447911123456");
  assertEquals(result.isValid, true);
  // libphonenumber-js "min" metadata returns "GG" for some UK mobile patterns
  // We just verify the phone is valid and correctly normalized
});

Deno.test("PHU-008: normalizePhoneOrFallback - Ukrainian number", () => {
  // Ukrainian numbers may not validate in "min" metadata, but fallback should work
  const result = normalizePhoneOrFallback("+380 50 123 4567");
  assertEquals(result, "+380501234567");
});

Deno.test("PHU-009: normalizePhone - empty input returns error", () => {
  const result = normalizePhone("");
  assertEquals(result.phone, "");
  assertEquals(result.isValid, false);
  assertExists(result.error);
});

Deno.test("PHU-010: normalizePhone - spaces and dashes removed", () => {
  const result = normalizePhone("733-854-184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-011: normalizePhone - parentheses removed", () => {
  const result = normalizePhone("(733) 854 184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-012: normalizePhone - 11 digits starting with 48", () => {
  const result = normalizePhone("48733854184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-013: normalizePhone - preserves existing + prefix", () => {
  const result = normalizePhone("+48 733 854 184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-014: normalizePhone - German with trunk zero (+49 0)", () => {
  const result = normalizePhone("+49 0 171 1234567");
  assertEquals(result.phone, "+491711234567");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-015: isValidPhone - valid Polish 9-digit", () => {
  assertEquals(isValidPhone("733854184"), true);
});

Deno.test("PHU-016: isValidPhone - valid international", () => {
  assertEquals(isValidPhone("+49171234567"), true);
});

Deno.test("PHU-017: isValidPhone - invalid too short", () => {
  assertEquals(isValidPhone("12345"), false);
});

Deno.test("PHU-018: isValidPhone - invalid random text", () => {
  assertEquals(isValidPhone("not-a-phone"), false);
});

Deno.test("PHU-019: normalizePhoneOrFallback - 9 digits without +", () => {
  const result = normalizePhoneOrFallback("733854184");
  assertEquals(result, "+48733854184");
});

Deno.test("PHU-020: normalizePhoneOrFallback - 4848 double prefix (without +)", () => {
  const result = normalizePhoneOrFallback("4848733854184");
  assertEquals(result, "+48733854184");
});

Deno.test("PHU-021: normalizePhoneOrFallback - 00 prefix", () => {
  const result = normalizePhoneOrFallback("0048733854184");
  assertEquals(result, "+48733854184");
});

Deno.test("PHU-022: normalizePhoneOrFallback - German default country", () => {
  const result = normalizePhoneOrFallback("1711234567", "DE");
  assertEquals(result, "+491711234567");
});

Deno.test("PHU-023: normalizePhone - dots removed", () => {
  const result = normalizePhone("733.854.184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-024: normalizePhoneOrFallback - Czech number", () => {
  // Czech numbers may not validate in "min" metadata, but fallback should work
  const result = normalizePhoneOrFallback("+420 777 123 456");
  assertEquals(result, "+420777123456");
});

Deno.test("PHU-025: normalizePhoneOrFallback - handles 380 Ukrainian prefix", () => {
  const result = normalizePhoneOrFallback("380501234567");
  assertEquals(result, "+380501234567");
});

// ============================================================================
// Additional coverage for uncovered branches
// ============================================================================

Deno.test("PHU-026: normalizePhone - invalid number returns error with parsed number", () => {
  // Very short number that won't parse correctly
  const result = normalizePhone("123");
  assertEquals(result.isValid, false);
  assertExists(result.error);
});

Deno.test("PHU-027: normalizePhoneOrFallback - 11 digits starting with 48", () => {
  // This tests the specific branch for Polish 11-digit numbers
  const result = normalizePhoneOrFallback("48733854184");
  assertEquals(result, "+48733854184");
});

Deno.test("PHU-028: normalizePhoneOrFallback - 11+ digits with known country code (DE)", () => {
  // Tests the branch for 11+ digits starting with known country codes
  const result = normalizePhoneOrFallback("491711234567");
  assertEquals(result, "+491711234567");
});

Deno.test("PHU-029: normalizePhoneOrFallback - unknown format gets default prefix", () => {
  // Tests the else branch - unknown format gets default country prefix
  const result = normalizePhoneOrFallback("12345678"); // 8 digits - not 9, not 11+
  assertEquals(result, "+4812345678");
});

Deno.test("PHU-030: normalizePhoneOrFallback - custom default country", () => {
  // Tests fallback with non-PL default country
  const result = normalizePhoneOrFallback("1711234567", "DE");
  // 10 digits, doesn't start with known prefix, gets DE prefix
  assertEquals(result, "+491711234567");
});

Deno.test("PHU-031: normalizePhone - retry with + prefix succeeds", () => {
  // Test case where initial parse fails but retry with + works
  // 11 digits starting with 48 - first parse may fail, retry should work
  const result = normalizePhone("48733854184");
  assertEquals(result.phone, "+48733854184");
  assertEquals(result.isValid, true);
});

Deno.test("PHU-032: normalizePhoneOrFallback - 4848 double prefix without +", () => {
  // Tests the specific branch for 4848 pattern without +
  const result = normalizePhoneOrFallback("4848733854184");
  assertEquals(result, "+48733854184");
});

Deno.test("PHU-033: normalizePhoneOrFallback - country code not in map uses PL default", () => {
  // Tests fallback when country code is not in the map
  const result = normalizePhoneOrFallback("123456789", "XX" as any);
  // XX not in map, should use "48" as default
  assertEquals(result, "+48123456789");
});

Deno.test("PHU-034: normalizePhone - handles parse exception", () => {
  // Test with malformed input that might cause parse exception
  // This is hard to trigger with libphonenumber, but we test edge case
  const result = normalizePhone("+");
  assertEquals(result.isValid, false);
  assertExists(result.error);
});

Deno.test("PHU-035: normalizePhoneOrFallback - handles 11+ digits with UA prefix", () => {
  const result = normalizePhoneOrFallback("380501234567");
  assertEquals(result, "+380501234567");
});

Deno.test("PHU-036: normalizePhoneOrFallback - handles 11+ digits with CZ prefix", () => {
  const result = normalizePhoneOrFallback("420777123456");
  assertEquals(result, "+420777123456");
});
