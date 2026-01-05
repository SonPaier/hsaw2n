import { colord, extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';

// Extend colord with accessibility plugin
extend([a11yPlugin]);

/**
 * Determines the best text color (white or dark) for a given background color
 * Based on WCAG contrast requirements
 */
export const getContrastTextColor = (bgColor: string): string => {
  try {
    const color = colord(bgColor);
    // Check if white text would be readable on this background
    // Using AAA standard (7:1 ratio) for better accessibility
    const isWhiteReadable = color.contrast('#ffffff') >= 4.5;
    return isWhiteReadable ? '#ffffff' : '#1e293b';
  } catch {
    return '#1e293b';
  }
};

/**
 * Checks if two colors have sufficient contrast for WCAG AA compliance
 */
export const hasGoodContrast = (color1: string, color2: string): boolean => {
  try {
    return colord(color1).contrast(color2) >= 4.5;
  } catch {
    return false;
  }
};

/**
 * Gets the contrast ratio between two colors
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  try {
    return colord(color1).contrast(color2);
  } catch {
    return 1;
  }
};

/**
 * Validates if a string is a valid hex color
 */
export const isValidHexColor = (color: string): boolean => {
  try {
    return colord(color).isValid();
  } catch {
    return false;
  }
};

/**
 * Lightens a color by a percentage
 */
export const lightenColor = (color: string, amount: number = 0.1): string => {
  try {
    return colord(color).lighten(amount).toHex();
  } catch {
    return color;
  }
};

/**
 * Darkens a color by a percentage
 */
export const darkenColor = (color: string, amount: number = 0.1): string => {
  try {
    return colord(color).darken(amount).toHex();
  } catch {
    return color;
  }
};

// Default branding colors
export const DEFAULT_BRANDING = {
  offer_bg_color: '#f8fafc',
  offer_header_bg_color: '#ffffff',
  offer_header_text_color: '#1e293b',
  offer_section_bg_color: '#ffffff',
  offer_section_text_color: '#1e293b',
  offer_primary_color: '#2563eb',
};

export interface OfferBranding {
  offer_branding_enabled: boolean;
  offer_bg_color: string;
  offer_header_bg_color: string;
  offer_header_text_color: string;
  offer_section_bg_color: string;
  offer_section_text_color: string;
  offer_primary_color: string;
}
