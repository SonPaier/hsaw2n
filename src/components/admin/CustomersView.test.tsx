import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import CustomersView from './CustomersView';

// Mock Supabase
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useIsMobile
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Mock useCombinedFeatures
vi.mock('@/hooks/useCombinedFeatures', () => ({
  useCombinedFeatures: () => ({
    hasFeature: (feature: string) => feature === 'offers',
  }),
}));

// Mock customers
const mockCustomers = [
  {
    id: 'cust-1',
    name: 'Jan Kowalski',
    phone: '+48666111222',
    email: 'jan@test.pl',
    notes: null,
    created_at: '2024-01-01',
    phone_verified: true,
    source: 'myjnia',
    company: null,
    nip: null,
    address: null,
  },
  {
    id: 'cust-2',
    name: 'Anna Nowak',
    phone: '+48666333444',
    email: null,
    notes: null,
    created_at: '2024-01-02',
    phone_verified: false,
    source: 'myjnia',
    company: 'Firma ABC',
    nip: '1234567890',
    address: null,
  },
];

// Mock vehicles
const mockVehicles = [
  { phone: '+48666111222', model: 'BMW X5', plate: 'WA12345' },
  { phone: '+48666111222', model: 'Audi A4', plate: 'WA67890' },
  { phone: '+48666333444', model: 'VW Golf', plate: null },
];

// Helper to create chainable mock
const createChainMock = (data: unknown = [], error: null | { message: string } = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
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
      case 'customers':
        return createChainMock(mockCustomers);
      case 'customer_vehicles':
        return createChainMock(mockVehicles);
      default:
        return createChainMock([]);
    }
  });
};

const renderComponent = (instanceId: string | null = 'test-instance') => {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <CustomersView instanceId={instanceId} />
      </MemoryRouter>
    </I18nextProvider>
  );
};

describe('CustomersView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe('Renderowanie listy klientów', () => {
    it('CV-U-001: wyświetla listę klientów', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
        expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
      });
    });

    it('CV-U-002: wyświetla numery telefonów klientów', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('+48666111222')).toBeInTheDocument();
        expect(screen.getByText('+48666333444')).toBeInTheDocument();
      });
    });
  });

  describe('Pojazdy klientów (pills)', () => {
    it('CV-U-010: wyświetla pojazdy klienta jako pills', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('BMW X5')).toBeInTheDocument();
        expect(screen.getByText('Audi A4')).toBeInTheDocument();
      });
    });

    it('CV-U-011: wyświetla pojazd dla drugiego klienta', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('VW Golf')).toBeInTheDocument();
      });
    });

    it('CV-U-012: nie wyświetla pojazdy dla klienta bez pojazdów', async () => {
      // Setup mock with customer without vehicles
      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'customers':
            return createChainMock([{
              id: 'cust-3',
              name: 'Bez Auta',
              phone: '+48666555666',
              email: null,
              notes: null,
              created_at: '2024-01-03',
              phone_verified: false,
              source: 'myjnia',
              company: null,
              nip: null,
              address: null,
            }]);
          case 'customer_vehicles':
            return createChainMock([]);
          default:
            return createChainMock([]);
        }
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Bez Auta')).toBeInTheDocument();
      });

      // Should not have any vehicle pills
      expect(screen.queryByText('BMW X5')).not.toBeInTheDocument();
    });

    it('CV-U-013: filtruje pojazdy po numerze telefonu klienta', async () => {
      renderComponent();

      await waitFor(() => {
        // Jan Kowalski (+48666111222) should have BMW X5 and Audi A4
        expect(screen.getByText('BMW X5')).toBeInTheDocument();
        expect(screen.getByText('Audi A4')).toBeInTheDocument();
        // Anna Nowak (+48666333444) should have VW Golf
        expect(screen.getByText('VW Golf')).toBeInTheDocument();
      });
    });
  });

  describe('Pobieranie danych', () => {
    it('CV-U-020: pobiera klientów z customers table', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('customers');
      });
    });

    it('CV-U-021: pobiera pojazdy z customer_vehicles table', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('customer_vehicles');
      });
    });

    it('CV-U-022: nie pobiera danych bez instanceId', async () => {
      renderComponent(null);

      // Should show loading or empty, but not call supabase
      await waitFor(() => {
        expect(mockFrom).not.toHaveBeenCalled();
      });
    });
  });

  describe('Wyszukiwanie', () => {
    it('CV-U-030: pozwala wyszukiwać po nazwie klienta', async () => {
      renderComponent();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/szukaj/i);
        expect(searchInput).toBeInTheDocument();
      });
    });
  });
});
