import { vi } from "vitest";

export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

export type ViewportSize = keyof typeof VIEWPORTS;

/**
 * Sets the viewport size for testing responsive components.
 * Updates window.innerWidth, window.innerHeight, matchMedia mock, and triggers resize event.
 * 
 * @param size - The viewport size: 'mobile', 'tablet', or 'desktop'
 */
export function setViewport(size: ViewportSize): void {
  const { width, height } = VIEWPORTS[size];

  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });

  // Update matchMedia mock to reflect new viewport
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => {
      const matches = evaluateMediaQuery(query, width);

      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      };
    },
  });

  // Trigger resize event to notify components
  window.dispatchEvent(new Event("resize"));
}

/**
 * Evaluates a media query string against the given width.
 * Supports: max-width, min-width patterns.
 */
function evaluateMediaQuery(query: string, width: number): boolean {
  // Handle (max-width: Xpx)
  const maxWidthMatch = query.match(/\(max-width:\s*(\d+)px\)/);
  if (maxWidthMatch) {
    return width <= parseInt(maxWidthMatch[1], 10);
  }

  // Handle (min-width: Xpx)
  const minWidthMatch = query.match(/\(min-width:\s*(\d+)px\)/);
  if (minWidthMatch) {
    return width >= parseInt(minWidthMatch[1], 10);
  }

  // Default: no match
  return false;
}

/**
 * Resets viewport to desktop (default for most tests).
 */
export function resetViewport(): void {
  setViewport("desktop");
}
