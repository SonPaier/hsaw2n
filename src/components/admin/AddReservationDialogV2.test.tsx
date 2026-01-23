import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import AddReservationDialogV2 from './AddReservationDialogV2';
import { CarModelsProvider } from '@/contexts/CarModelsContext';

// Mock Supabase
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, params?: unknown) => mockRpc(fn, params),
    auth: {
      getUser: vi.fn().mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      }),
    },
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock push notifications
vi.mock('@/lib/pushNotifications', () => ({
  sendPushNotification: vi.fn(),
  formatDateForPush: vi.fn(() => '01.02'),
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    loading: false,
  }),
}));

// Mock useIsMobile
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Default working hours
const defaultWorkingHours = {
  monday: { open: '08:00', close: '18:00' },
  tuesday: { open: '08:00', close: '18:00' },
  wednesday: { open: '08:00', close: '18:00' },
  thursday: { open: '08:00', close: '18:00' },
  friday: { open: '08:00', close: '18:00' },
  saturday: { open: '09:00', close: '14:00' },
  sunday: null,
};

// Mock services
const mockServices = [
  {
    id: 'svc-1',
    name: 'Mycie podstawowe',
    shortcut: 'MP',
    category_id: 'cat-1',
    duration_minutes: 30,
    duration_small: 25,
    duration_medium: 30,
    duration_large: 40,
    price_from: 50,
    price_small: 40,
    price_medium: 50,
    price_large: 70,
    station_type: 'washing',
    is_popular: true,
  },
];

const mockStations = [
  { id: 'sta-1', name: 'Stanowisko 1', type: 'washing' },
  { id: 'sta-2', name: 'Stanowisko 2', type: 'washing' },
];

const mockCarModels = [
  { id: 'car-1', brand: 'BMW', name: 'X5', size: 'L', active: true, status: 'active' },
  { id: 'car-2', brand: 'Audi', name: 'A4', size: 'M', active: true, status: 'active' },
];

// Helper to create chainable mock
const createChainMock = (data: unknown = [], error: null | { message: string } = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  then: (resolve: (val: { data: unknown; error: null | { message: string } }) => void) => {
    resolve({ data, error });
    return Promise.resolve({ data, error });
  },
});

// Setup default mocks
const setupMocks = () => {
  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case 'services':
        return createChainMock(mockServices);
      case 'stations':
        return createChainMock(mockStations);
      case 'customer_vehicles':
        return createChainMock([]);
      case 'customers':
        return createChainMock([]);
      case 'reservations':
        return createChainMock({ id: 'new-res-id' });
      case 'yard_vehicles':
        return createChainMock({ id: 'new-yard-id' });
      case 'car_models':
        return createChainMock(mockCarModels);
      default:
        return createChainMock([]);
    }
  });

  mockRpc.mockResolvedValue({ data: [], error: null });
};

const renderComponent = (props: Partial<React.ComponentProps<typeof AddReservationDialogV2>> = {}) => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    instanceId: 'test-instance-id',
    onSuccess: vi.fn(),
    workingHours: defaultWorkingHours,
    mode: 'reservation' as const,
    currentUsername: 'test-user',
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <CarModelsProvider>
          <AddReservationDialogV2 {...defaultProps} {...props} />
        </CarModelsProvider>
      </MemoryRouter>
    </I18nextProvider>
  );
};

describe('AddReservationDialogV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe('Renderowanie dialogu', () => {
    it('RES-U-001: wyświetla tytuł "Nowa rezerwacja" w trybie reservation', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Nowa rezerwacja/i)).toBeInTheDocument();
      });
    });

    it('RES-U-002: wyświetla tytuł "Dodaj pojazd na plac" w trybie yard', async () => {
      renderComponent({ mode: 'yard' });

      await waitFor(() => {
        expect(screen.getByText(/Dodaj pojazd na plac/i)).toBeInTheDocument();
      });
    });

    it('RES-U-003: wyświetla pole telefonu', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/telefon/i)).toBeInTheDocument();
      });
    });

    it('RES-U-004: wyświetla przyciski rozmiaru auta (S, M, L)', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument();
      });
    });
  });

  describe('Tryb edycji', () => {
    const mockEditingReservation = {
      id: 'res-1',
      customer_name: 'Jan Kowalski',
      customer_phone: '123456789',
      vehicle_plate: 'BMW X5',
      car_size: 'medium' as const,
      reservation_date: '2024-02-01',
      start_time: '10:00:00',
      end_time: '11:30:00',
      station_id: 'sta-1',
      service_ids: ['svc-1'],
      customer_notes: 'Test notes',
      admin_notes: 'Admin notes',
      price: 150,
      confirmation_code: 'ABC123',
    };

    it('RES-U-040: wyświetla tytuł "Edytuj rezerwację"', async () => {
      renderComponent({ 
        mode: 'reservation',
        editingReservation: mockEditingReservation,
      });

      await waitFor(() => {
        expect(screen.getByText(/Edytuj rezerwację/i)).toBeInTheDocument();
      });
    });

    it('RES-U-041: wypełnia pole telefonu danymi rezerwacji', async () => {
      renderComponent({ 
        mode: 'reservation',
        editingReservation: mockEditingReservation,
      });

      await waitFor(() => {
        const phoneInput = screen.getByLabelText(/telefon/i);
        // Phone is formatted with spaces: "123 456 789"
        expect(phoneInput).toHaveValue('123 456 789');
      });
    });

    it('RES-U-042: wypełnia pole imienia danymi rezerwacji', async () => {
      renderComponent({ 
        mode: 'reservation',
        editingReservation: mockEditingReservation,
      });

      await waitFor(() => {
        // Find input by its value since label doesn't have proper "for" attribute
        const nameInput = screen.getByDisplayValue('Jan Kowalski');
        expect(nameInput).toBeInTheDocument();
      });
    });

    it('RES-U-043: wyświetla przycisk "Zmień termin"', async () => {
      renderComponent({ 
        mode: 'reservation',
        editingReservation: mockEditingReservation,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /zmień termin/i })).toBeInTheDocument();
      });
    });

    it('RES-U-044: kliknięcie "Zmień termin" zmienia stan UI', async () => {
      const user = userEvent.setup();
      renderComponent({ 
        mode: 'reservation',
        editingReservation: mockEditingReservation,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /zmień termin/i })).toBeInTheDocument();
      });

      const changeTermButton = screen.getByRole('button', { name: /zmień termin/i });
      await user.click(changeTermButton);

      // After clicking, the button text should change or be replaced
      await waitFor(() => {
        // Either "Anuluj" button appears or "Zmień termin" is no longer visible
        const buttons = screen.getAllByRole('button');
        const hasCancelOrChanged = buttons.some(btn => 
          btn.textContent?.toLowerCase().includes('anuluj') ||
          btn.textContent?.toLowerCase().includes('cofnij')
        ) || !screen.queryByRole('button', { name: /zmień termin/i });
        
        expect(hasCancelOrChanged).toBe(true);
      });
    });
  });

  describe('Interakcje UI', () => {
    it('RES-U-050: zmiana rozmiaru auta zmienia aktywny przycisk', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
      });

      // M is default active
      const buttonM = screen.getByRole('button', { name: 'M' });
      expect(buttonM.className).toContain('bg-primary');

      // Click L
      const buttonL = screen.getByRole('button', { name: 'L' });
      await user.click(buttonL);

      await waitFor(() => {
        expect(buttonL.className).toContain('bg-primary');
      });
    });

    it('RES-U-051: wpisanie telefonu aktualizuje wartość', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/telefon/i)).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/telefon/i);
      await user.type(phoneInput, '123456789');

      // Phone is formatted with spaces: "123 456 789"
      expect(phoneInput).toHaveValue('123 456 789');
    });
  });
});
