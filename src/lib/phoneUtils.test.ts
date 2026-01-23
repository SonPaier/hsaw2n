import { describe, it, expect } from 'vitest';
import { normalizePhone, stripPhone, isValidPhone, formatPhoneDisplay } from './phoneUtils';

describe('phoneUtils', () => {
  describe('normalizePhone', () => {
    it('PU-U-001: normalizes 9-digit Polish number to E.164', () => {
      expect(normalizePhone('733854184')).toBe('+48733854184');
    });

    it('PU-U-002: preserves +48 prefix and removes spaces', () => {
      expect(normalizePhone('+48 733 854 184')).toBe('+48733854184');
    });

    it('PU-U-003: converts 0048 prefix to +48', () => {
      expect(normalizePhone('0048 733 854 184')).toBe('+48733854184');
    });

    it('PU-U-004: handles international numbers with country code', () => {
      expect(normalizePhone('+49 171 1234567')).toBe('+491711234567');
    });

    it('PU-U-005: removes trunk zero after country code (German format)', () => {
      expect(normalizePhone('+49 0 171 1234567')).toBe('+491711234567');
    });

    it('PU-U-006: handles Polish number with 48 prefix already included', () => {
      expect(normalizePhone('48733854184')).toBe('+48733854184');
    });

    it('PU-U-007: handles Norwegian numbers (without leading zero)', () => {
      // Norwegian numbers don't typically start with 0, so test with valid format
      expect(normalizePhone('+47 123 45 678')).toBe('+4712345678');
    });

    it('PU-U-008: handles Ukrainian numbers with 380 prefix', () => {
      expect(normalizePhone('380501234567')).toBe('+380501234567');
    });

    it('PU-U-009: returns empty string for empty input', () => {
      expect(normalizePhone('')).toBe('');
    });

    it('PU-U-010: handles numbers with various separators', () => {
      expect(normalizePhone('733-854-184')).toBe('+48733854184');
      expect(normalizePhone('(733) 854 184')).toBe('+48733854184');
    });
  });

  describe('stripPhone', () => {
    it('PU-U-011: removes all non-digit characters', () => {
      expect(stripPhone('+48 733-854-184')).toBe('48733854184');
    });

    it('PU-U-012: handles already clean numbers', () => {
      expect(stripPhone('733854184')).toBe('733854184');
    });

    it('PU-U-013: returns empty string for empty input', () => {
      expect(stripPhone('')).toBe('');
    });
  });

  describe('isValidPhone', () => {
    it('PU-U-014: validates correct Polish 9-digit number', () => {
      expect(isValidPhone('733854184')).toBe(true);
    });

    it('PU-U-015: validates correct international number', () => {
      expect(isValidPhone('+49171234567')).toBe(true);
    });

    it('PU-U-016: rejects too short numbers', () => {
      expect(isValidPhone('12345')).toBe(false);
    });

    it('PU-U-017: rejects too long numbers (>15 digits)', () => {
      expect(isValidPhone('1234567890123456789')).toBe(false);
    });

    it('PU-U-018: validates edge case - 8 digits (minimum)', () => {
      expect(isValidPhone('12345678')).toBe(true);
    });
  });

  describe('formatPhoneDisplay', () => {
    it('PU-U-019: formats Polish number without +48 prefix', () => {
      expect(formatPhoneDisplay('+48733854184')).toBe('733 854 184');
    });

    it('PU-U-020: formats Polish number with spaces in input', () => {
      expect(formatPhoneDisplay('+48 733 854 184')).toBe('733 854 184');
    });

    it('PU-U-021: keeps international prefix for non-Polish numbers', () => {
      expect(formatPhoneDisplay('+49123456789')).toBe('+49 123 456 789');
    });

    it('PU-U-022: handles raw 9-digit Polish number', () => {
      expect(formatPhoneDisplay('733854184')).toBe('733 854 184');
    });

    it('PU-U-023: returns empty string for empty input', () => {
      expect(formatPhoneDisplay('')).toBe('');
    });

    it('PU-U-024: formats number with 48 prefix (without +)', () => {
      expect(formatPhoneDisplay('48733854184')).toBe('733 854 184');
    });
  });
});
