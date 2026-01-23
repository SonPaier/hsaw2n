import { vi } from 'vitest';

/**
 * Mock modules for unit tests.
 * Import this file in test files that need these mocks.
 */

// Mock sonner toast
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: mockToast,
}));

// Mock push notifications
export const mockSendPushNotification = vi.fn().mockResolvedValue(undefined);
export const mockFormatDateForPush = vi.fn((date: Date) => {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
});

vi.mock('@/lib/pushNotifications', () => ({
  sendPushNotification: mockSendPushNotification,
  formatDateForPush: mockFormatDateForPush,
}));

// Mock useAuth hook
export const mockAuth = {
  user: { id: 'test-user-id', email: 'test@example.com' },
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

// Helper to reset all mocks
export const resetModuleMocks = () => {
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  mockToast.info.mockClear();
  mockToast.warning.mockClear();
  mockToast.loading.mockClear();
  mockToast.dismiss.mockClear();
  mockSendPushNotification.mockClear();
  mockFormatDateForPush.mockClear();
  mockAuth.signIn.mockClear();
  mockAuth.signOut.mockClear();
};
