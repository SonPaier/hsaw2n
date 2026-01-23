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
