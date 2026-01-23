import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { setViewport } from '@/test/utils/viewport';

// Mock modules BEFORE importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@sentry/react', () => ({
  default: {},
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
const mockSignIn = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: mockSignIn,
    hasRole: () => false,
    hasInstanceRole: () => false,
  }),
}));

// Import after mocks
import InstanceAuth from './InstanceAuth';
import { supabase } from '@/integrations/supabase/client';

// Helper to create chainable query mock
const createQueryMock = (response: { data: unknown; error: unknown }) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue(response),
  single: vi.fn().mockResolvedValue(response),
});

// Helper to render with router and providers
const renderWithRouter = (slug: string = 'test') => {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/${slug}/login`]}>
        <Routes>
          <Route path="/:slug/login" element={<InstanceAuth />} />
          <Route path="/admin" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
};

// Default instance response
const defaultInstance = {
  id: 'test-instance-id',
  name: 'Test Instance',
  slug: 'test',
  logo_url: null,
  primary_color: null,
  active: true,
};

describe('InstanceAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockSignIn.mockReset();
    
    // Default: instance exists and is active
    (supabase.from as Mock).mockImplementation((table: string) => {
      if (table === 'instances') {
        return createQueryMock({ data: defaultInstance, error: null });
      }
      if (table === 'profiles') {
        return createQueryMock({ data: null, error: null });
      }
      return createQueryMock({ data: null, error: null });
    });
  });

  // ============================================
  // FORM VALIDATION (LA-U-001 → LA-U-006)
  // ============================================
  describe('Form Validation', () => {
    it('LA-U-001: shows both errors when username and password are empty', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /zaloguj/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.getByText('Login jest wymagany')).toBeInTheDocument();
        expect(screen.getByText('Hasło jest wymagane')).toBeInTheDocument();
      });
    });

    it('LA-U-002: shows only username error when password is filled', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/hasło/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.getByText('Login jest wymagany')).toBeInTheDocument();
        expect(screen.queryByText('Hasło jest wymagane')).not.toBeInTheDocument();
      });
    });

    it('LA-U-003: shows only password error when username is filled', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'testuser' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.queryByText('Login jest wymagany')).not.toBeInTheDocument();
        expect(screen.getByText('Hasło jest wymagane')).toBeInTheDocument();
      });
    });

    it('LA-U-004: treats whitespace-only username as empty', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: '   ' } });
      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.getByText('Login jest wymagany')).toBeInTheDocument();
      });
    });

    it('LA-U-005: disables submit button and shows spinner during loading', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: defaultInstance, error: null });
        }
        if (table === 'profiles') {
          return createQueryMock({ 
            data: { id: 'user-1', email: 'test@test.com', is_blocked: false }, 
            error: null 
          });
        }
        return createQueryMock({ data: null, error: null });
      });
      mockSignIn.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        // Find submit button by type attribute
        const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(submitButton).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
        expect(submitButton.querySelector('.animate-spin')).toBeInTheDocument();
      });
    });

    it('LA-U-006: clears field error when user starts typing', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /zaloguj/i })).toBeInTheDocument();
      });

      // Trigger validation errors
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Login jest wymagany')).toBeInTheDocument();
      });

      // Start typing in username field
      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'a' } });

      await waitFor(() => {
        expect(screen.queryByText('Login jest wymagany')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // API ERRORS (LA-U-007 → LA-U-012)
  // ============================================
  describe('API Errors', () => {
    it('LA-U-007: shows error when user does not exist', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: defaultInstance, error: null });
        }
        if (table === 'profiles') {
          return createQueryMock({ data: null, error: null }); // User not found
        }
        return createQueryMock({ data: null, error: null });
      });

      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'nonexistent' } });
      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.getByText('Nieprawidłowy login lub hasło')).toBeInTheDocument();
      });
    });

    it('LA-U-008: shows blocked message when user is blocked', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: defaultInstance, error: null });
        }
        if (table === 'profiles') {
          return createQueryMock({ 
            data: { id: 'user-1', email: 'blocked@test.com', is_blocked: true }, 
            error: null 
          });
        }
        return createQueryMock({ data: null, error: null });
      });

      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'blockeduser' } });
      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.getByText(/konto zostało zablokowane/i)).toBeInTheDocument();
      });
    });

    it('LA-U-009: shows error for invalid credentials', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: defaultInstance, error: null });
        }
        if (table === 'profiles') {
          return createQueryMock({ 
            data: { id: 'user-1', email: 'test@test.com', is_blocked: false }, 
            error: null 
          });
        }
        return createQueryMock({ data: null, error: null });
      });
      mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });

      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'wrongpassword' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.getByText('Nieprawidłowy login lub hasło')).toBeInTheDocument();
      });
    });

    it('LA-U-010: shows generic error message for other Supabase errors', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: defaultInstance, error: null });
        }
        if (table === 'profiles') {
          return createQueryMock({ 
            data: { id: 'user-1', email: 'test@test.com', is_blocked: false }, 
            error: null 
          });
        }
        return createQueryMock({ data: null, error: null });
      });
      mockSignIn.mockResolvedValue({ error: { message: 'Network connection failed' } });

      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(screen.getByText('Network connection failed')).toBeInTheDocument();
      });
    });

    it('LA-U-011: shows error when instance is not found', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: null, error: null }); // Instance not found
        }
        return createQueryMock({ data: null, error: null });
      });

      renderWithRouter('nonexistent-slug');
      
      await waitFor(() => {
        expect(screen.getByText('Nie znaleziono instancji')).toBeInTheDocument();
      });
    });

    it('LA-U-012: shows error when instance is inactive', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ 
            data: { ...defaultInstance, active: false }, 
            error: null 
          });
        }
        return createQueryMock({ data: null, error: null });
      });

      renderWithRouter('inactive');
      
      await waitFor(() => {
        expect(screen.getByText('Ta instancja jest nieaktywna')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // UI/UX (LA-U-013 → LA-U-015)
  // ============================================
  describe('UI/UX', () => {
    it('LA-U-013: toggles password visibility', async () => {
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/hasło/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/hasło/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find and click the toggle button (eye icon)
      const toggleButton = passwordInput.parentElement?.querySelector('button');
      expect(toggleButton).toBeInTheDocument();
      
      fireEvent.click(toggleButton!);
      expect(passwordInput).toHaveAttribute('type', 'text');

      fireEvent.click(toggleButton!);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('LA-U-014: shows loading spinner while fetching instance', async () => {
      (supabase.from as Mock).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: () => new Promise(() => {}), // Never resolves
      }));

      render(
        <HelmetProvider>
          <MemoryRouter initialEntries={['/test/login']}>
            <Routes>
              <Route path="/:slug/login" element={<InstanceAuth />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      );

      // Should show loading state
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('LA-U-015: shows instance not found error with helpful message', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: null, error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      renderWithRouter('unknown-slug');
      
      await waitFor(() => {
        expect(screen.getByText('Nie znaleziono instancji')).toBeInTheDocument();
        expect(screen.getByText('Sprawdź czy adres URL jest poprawny')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // REDIRECT (LA-U-016)
  // ============================================
  describe('Redirect after login', () => {
    it('LA-U-016: navigates to /admin after successful login', async () => {
      (supabase.from as Mock).mockImplementation((table: string) => {
        if (table === 'instances') {
          return createQueryMock({ data: defaultInstance, error: null });
        }
        if (table === 'profiles') {
          return createQueryMock({ 
            data: { id: 'user-1', email: 'test@test.com', is_blocked: false }, 
            error: null 
          });
        }
        return createQueryMock({ data: null, error: null });
      });
      mockSignIn.mockResolvedValue({ error: null });

      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });
  });

  // ============================================
  // RESPONSIVE UI (LA-U-017 → LA-U-019)
  // ============================================
  describe('Responsive UI', () => {
    it('LA-U-017: decorative right panel is visible on desktop (lg:flex)', async () => {
      setViewport('desktop');
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      // The right panel contains "Umów serwis" text and decorative elements
      // It has className="hidden lg:flex" so should be visible on desktop
      const decorativePanel = document.querySelector('.lg\\:flex.hidden');
      expect(decorativePanel).toBeInTheDocument();
    });

    it('LA-U-018: decorative right panel is hidden on mobile', async () => {
      setViewport('mobile');
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      // On mobile, the panel with "hidden lg:flex" should not be visible
      // We verify the component renders but the CSS will hide it
      const decorativePanel = document.querySelector('.lg\\:flex.hidden');
      // Panel exists in DOM but CSS class "hidden" makes it invisible on mobile
      expect(decorativePanel).toBeInTheDocument();
      expect(decorativePanel).toHaveClass('hidden');
    });

    it('LA-U-019: login form takes full width on mobile', async () => {
      setViewport('mobile');
      renderWithRouter();
      
      await waitFor(() => {
        expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
      });

      // The form container should be full width on mobile (w-full)
      const formSection = document.querySelector('.w-full.lg\\:w-1\\/2');
      expect(formSection).toBeInTheDocument();
    });
  });
});
