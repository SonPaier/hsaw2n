import "jsr:@std/dotenv/load";
import { assertEquals, assertMatch } from "jsr:@std/assert";
import {
  calculateEndTime,
  generateConfirmationCode,
  generateVerificationCode,
  formatDateForSms,
  buildConfirmationSms,
  buildVerificationSms,
  validateDirectReservationRequest,
  validateSendSmsRequest,
  validateVerifySmsRequest,
  parseCarModel,
  mapCarSize,
} from "./reservationUtils.ts";

// ============================================================================
// CRD - Create Reservation Direct Related Tests (Pure Logic)
// ============================================================================

Deno.test("CRD-007: calculateEndTime - 09:00 + 90min = 10:30", () => {
  assertEquals(calculateEndTime("09:00", 90), "10:30");
});

Deno.test("CRD-007b: calculateEndTime - 09:00 + 60min = 10:00", () => {
  assertEquals(calculateEndTime("09:00", 60), "10:00");
});

Deno.test("CRD-007c: calculateEndTime - 23:00 + 120min = 01:00 (overflow)", () => {
  assertEquals(calculateEndTime("23:00", 120), "01:00");
});

Deno.test("CRD-007d: calculateEndTime - 14:30 + 45min = 15:15", () => {
  assertEquals(calculateEndTime("14:30", 45), "15:15");
});

Deno.test("CRD-008: generateConfirmationCode - returns 7 digits", () => {
  const code = generateConfirmationCode();
  assertMatch(code, /^\d{7}$/);
});

Deno.test("CRD-008b: generateConfirmationCode - generates different codes", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 100; i++) {
    codes.add(generateConfirmationCode());
  }
  // Should have at least 90 unique codes out of 100
  assertEquals(codes.size >= 90, true);
});

Deno.test("SSC-001: generateVerificationCode - returns 4 digits", () => {
  const code = generateVerificationCode();
  assertMatch(code, /^\d{4}$/);
});

Deno.test("SSC-001b: generateVerificationCode - range 1000-9999", () => {
  for (let i = 0; i < 100; i++) {
    const code = parseInt(generateVerificationCode());
    assertEquals(code >= 1000 && code <= 9999, true);
  }
});

Deno.test("CRD-015: formatDateForSms - formats Polish date correctly", () => {
  const result = formatDateForSms("2026-01-24");
  assertEquals(result.dayNum, 24);
  assertEquals(result.monthNameFull, "stycznia");
  assertEquals(result.monthName, "sty");
  assertEquals(result.dayName, "sobota");
});

Deno.test("CRD-015b: formatDateForSms - handles all months", () => {
  const months = [
    { date: "2026-01-15", expected: "stycznia" },
    { date: "2026-02-15", expected: "lutego" },
    { date: "2026-03-15", expected: "marca" },
    { date: "2026-06-15", expected: "czerwca" },
    { date: "2026-12-15", expected: "grudnia" },
  ];
  
  for (const { date, expected } of months) {
    const result = formatDateForSms(date);
    assertEquals(result.monthNameFull, expected);
  }
});

Deno.test("CRD-015c: buildConfirmationSms - auto-confirm message", () => {
  const sms = buildConfirmationSms({
    instanceName: "AutoSpa",
    dayNum: 24,
    monthNameFull: "stycznia",
    time: "10:00",
    autoConfirm: true,
    googleMapsUrl: null,
    editUrl: null,
  });
  
  assertEquals(sms, "AutoSpa: Rezerwacja potwierdzona! 24 stycznia o 10:00.");
});

Deno.test("CRD-016: buildConfirmationSms - pending message", () => {
  const sms = buildConfirmationSms({
    instanceName: "AutoSpa",
    dayNum: 24,
    monthNameFull: "stycznia",
    time: "10:00",
    autoConfirm: false,
    googleMapsUrl: null,
    editUrl: null,
  });
  
  assertEquals(sms.includes("Otrzymalismy prosbe o rezerwacje"), true);
  assertEquals(sms.includes("Potwierdzimy ja wkrotce"), true);
});

Deno.test("CRD-017: buildConfirmationSms - includes edit link", () => {
  const sms = buildConfirmationSms({
    instanceName: "AutoSpa",
    dayNum: 24,
    monthNameFull: "stycznia",
    time: "10:00",
    autoConfirm: true,
    googleMapsUrl: null,
    editUrl: "https://example.com/res?code=1234567",
  });
  
  assertEquals(sms.includes("Zmien lub anuluj: https://example.com/res?code=1234567"), true);
});

Deno.test("CRD-018: buildConfirmationSms - excludes edit link when null", () => {
  const sms = buildConfirmationSms({
    instanceName: "AutoSpa",
    dayNum: 24,
    monthNameFull: "stycznia",
    time: "10:00",
    autoConfirm: true,
    googleMapsUrl: null,
    editUrl: null,
  });
  
  assertEquals(sms.includes("Zmien lub anuluj"), false);
});

Deno.test("CRD-019: buildConfirmationSms - includes Google Maps link", () => {
  const sms = buildConfirmationSms({
    instanceName: "AutoSpa",
    dayNum: 24,
    monthNameFull: "stycznia",
    time: "10:00",
    autoConfirm: true,
    googleMapsUrl: "https://goo.gl/maps/abc",
    editUrl: null,
  });
  
  assertEquals(sms.includes("Dojazd: https://goo.gl/maps/abc"), true);
});

Deno.test("SSC-004: buildVerificationSms - formats correctly", () => {
  const sms = buildVerificationSms("AutoSpa", "1234");
  assertEquals(sms, "Kod potwierdzajacy AutoSpa: 1234");
});

Deno.test("CRD-002: validateDirectReservationRequest - missing instanceId", () => {
  const result = validateDirectReservationRequest({
    phone: "123456789",
    reservationData: {},
  });
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("instanceId"), true);
});

Deno.test("CRD-002b: validateDirectReservationRequest - missing phone", () => {
  const result = validateDirectReservationRequest({
    instanceId: "uuid",
    reservationData: {},
  });
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("phone"), true);
});

Deno.test("CRD-002c: validateDirectReservationRequest - missing reservationData", () => {
  const result = validateDirectReservationRequest({
    instanceId: "uuid",
    phone: "123456789",
  });
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes("reservationData"), true);
});

Deno.test("CRD-002d: validateDirectReservationRequest - valid request", () => {
  const result = validateDirectReservationRequest({
    instanceId: "uuid",
    phone: "123456789",
    reservationData: { serviceId: "abc" },
  });
  assertEquals(result.valid, true);
});

Deno.test("SSC-002: validateSendSmsRequest - missing fields", () => {
  assertEquals(validateSendSmsRequest({}).valid, false);
  assertEquals(validateSendSmsRequest({ phone: "123" }).valid, false);
  assertEquals(validateSendSmsRequest({ phone: "123", instanceId: "uuid" }).valid, false);
});

Deno.test("SSC-002b: validateSendSmsRequest - valid request", () => {
  const result = validateSendSmsRequest({
    phone: "123456789",
    instanceId: "uuid",
    reservationData: {},
  });
  assertEquals(result.valid, true);
});

Deno.test("VSC-002: validateVerifySmsRequest - missing fields", () => {
  assertEquals(validateVerifySmsRequest({}).valid, false);
  assertEquals(validateVerifySmsRequest({ phone: "123" }).valid, false);
  assertEquals(validateVerifySmsRequest({ phone: "123", code: "1234" }).valid, false);
});

Deno.test("VSC-002b: validateVerifySmsRequest - valid request", () => {
  const result = validateVerifySmsRequest({
    phone: "123456789",
    code: "1234",
    instanceId: "uuid",
  });
  assertEquals(result.valid, true);
});

Deno.test("CRD-023: parseCarModel - single word", () => {
  const result = parseCarModel("BMW");
  assertEquals(result.brand, "BMW");
  assertEquals(result.name, "BMW");
});

Deno.test("CRD-023b: parseCarModel - brand and model", () => {
  const result = parseCarModel("BMW X5");
  assertEquals(result.brand, "BMW");
  assertEquals(result.name, "X5");
});

Deno.test("CRD-023c: parseCarModel - brand and full model name", () => {
  const result = parseCarModel("Mercedes C 300 AMG");
  assertEquals(result.brand, "Mercedes");
  assertEquals(result.name, "C 300 AMG");
});

Deno.test("CRD-023d: mapCarSize - small to S", () => {
  assertEquals(mapCarSize("small"), "S");
});

Deno.test("CRD-023e: mapCarSize - large to L", () => {
  assertEquals(mapCarSize("large"), "L");
});

Deno.test("CRD-023f: mapCarSize - medium to M", () => {
  assertEquals(mapCarSize("medium"), "M");
});

Deno.test("CRD-023g: mapCarSize - undefined to M", () => {
  assertEquals(mapCarSize(undefined), "M");
});
